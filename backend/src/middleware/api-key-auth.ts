import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { ApiKeyService } from '../services/api-key.service';

export interface ApiKeyAuthRequest extends FastifyRequest {
  apiKey?: {
    keyId: string;
    subscriptionId: string;
    userId: string;
    allowedModels: string[]; // NEW: List of models this API key can access
  };
}

export interface ApiKeyAuthOptions {
  required?: boolean;
  allowInactive?: boolean;
  skipRoutes?: string[];
}

const API_KEY_HEADER = 'x-api-key';
const BEARER_PREFIX = 'Bearer ';

const apiKeyAuthPlugin: FastifyPluginAsync<ApiKeyAuthOptions> = async (fastify, options = {}) => {
  const { required = false, allowInactive = false, skipRoutes = [] } = options;
  
  // Initialize API key service
  const apiKeyService = new ApiKeyService(fastify);

  // Helper function to extract API key from request
  const extractApiKey = (request: FastifyRequest): string | null => {
    // Try x-api-key header first
    let apiKey = request.headers[API_KEY_HEADER] as string;
    
    if (!apiKey) {
      // Try Authorization header with Bearer prefix
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith(BEARER_PREFIX)) {
        apiKey = authHeader.substring(BEARER_PREFIX.length);
      }
    }

    return apiKey || null;
  };

  // API key validation hook
  fastify.addHook('preHandler', async (request: ApiKeyAuthRequest, reply: FastifyReply) => {
    // Skip validation for excluded routes
    if (skipRoutes.some(route => request.url.startsWith(route))) {
      return;
    }

    const apiKey = extractApiKey(request);

    // If no API key provided
    if (!apiKey) {
      if (required) {
        throw fastify.createAuthError('API key required');
      }
      return; // Continue without API key validation
    }

    try {
      // Validate the API key
      const validation = await apiKeyService.validateApiKey(apiKey);

      if (!validation.isValid) {
        fastify.log.warn({
          apiKey: apiKey.substring(0, 10) + '...',
          reason: validation.reason,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        }, 'Invalid API key attempt');

        throw fastify.createAuthError(validation.reason || 'Invalid API key');
      }

      // Attach API key information to request
      request.apiKey = {
        keyId: validation.keyId!,
        subscriptionId: validation.subscriptionId!,
        userId: validation.userId!,
        allowedModels: validation.allowedModels || [], // NEW: Include allowed models
      };

      fastify.log.debug({
        keyId: validation.keyId,
        subscriptionId: validation.subscriptionId,
        userId: validation.userId,
      }, 'API key validated successfully');

    } catch (error) {
      fastify.log.error(error, 'API key validation error');
      
      if (error.statusCode) {
        throw error;
      }
      
      throw fastify.createAuthError('API key validation failed');
    }
  });

  // Decorator for checking API key authentication
  fastify.decorate('requireApiKey', () => {
    return async (request: ApiKeyAuthRequest, reply: FastifyReply) => {
      if (!request.apiKey) {
        throw fastify.createAuthError('Valid API key required');
      }
    };
  });

  // Decorator for checking subscription access
  fastify.decorate('requireSubscriptionAccess', (targetSubscriptionId?: string) => {
    return async (request: ApiKeyAuthRequest, reply: FastifyReply) => {
      if (!request.apiKey) {
        throw fastify.createAuthError('Valid API key required');
      }

      const subscriptionId = targetSubscriptionId || request.params?.subscriptionId;
      
      if (subscriptionId && request.apiKey.subscriptionId !== subscriptionId) {
        throw fastify.createForbiddenError('API key does not have access to this subscription');
      }
    };
  });

  // NEW: Decorator for checking model access permissions
  fastify.decorate('requireModelAccess', (requestedModel: string) => {
    return async (request: ApiKeyAuthRequest, reply: FastifyReply) => {
      if (!request.apiKey) {
        throw fastify.createAuthError('Valid API key required');
      }

      if (!request.apiKey.allowedModels.includes(requestedModel)) {
        fastify.log.warn({
          keyId: request.apiKey.keyId,
          requestedModel,
          allowedModels: request.apiKey.allowedModels,
          ip: request.ip,
          userAgent: request.headers['user-agent']
        }, 'API key attempted access to unauthorized model');

        throw fastify.createForbiddenError(
          `API key does not have access to model: ${requestedModel}`
        );
      }
    };
  });

  // Rate limiting decorator per API key
  fastify.decorate('rateLimitByApiKey', (options: {
    max: number;
    timeWindow: string | number;
    keyGenerator?: (request: FastifyRequest) => string;
  }) => {
    const { max, timeWindow, keyGenerator } = options;

    return async (request: ApiKeyAuthRequest, reply: FastifyReply) => {
      if (!request.apiKey) {
        // If no API key, skip rate limiting or use IP-based limiting
        return;
      }

      const key = keyGenerator ? keyGenerator(request) : `api_key:${request.apiKey.keyId}`;
      
      // Implementation would depend on your rate limiting strategy
      // This is a simplified example - in practice you'd use Redis or similar
      const rateLimitKey = `rate_limit:${key}`;
      
      try {
        // Check rate limit (this is a placeholder - implement with your rate limiting solution)
        const currentCount = await fastify.redis?.get(rateLimitKey) || 0;
        
        if (parseInt(currentCount.toString()) >= max) {
          throw fastify.createError(429, 'Rate limit exceeded for API key');
        }
        
        // Increment counter
        const pipeline = fastify.redis?.multi();
        pipeline?.incr(rateLimitKey);
        pipeline?.expire(rateLimitKey, typeof timeWindow === 'string' ? 3600 : timeWindow);
        await pipeline?.exec();
        
      } catch (error) {
        if (error.statusCode === 429) {
          throw error;
        }
        
        fastify.log.warn(error, 'Rate limiting error - allowing request');
      }
    };
  });

  fastify.log.info('API key authentication plugin initialized');
};

// Plugin for protecting specific routes with API key auth
const apiKeyProtectedPlugin: FastifyPluginAsync = async (fastify) => {
  const apiKeyService = new ApiKeyService(fastify);

  // Middleware specifically for API endpoints that require API key authentication
  fastify.addHook('preHandler', async (request: ApiKeyAuthRequest, reply: FastifyReply) => {
    // Only apply to specific API routes (e.g., /api/v1/*)
    if (!request.url.startsWith('/api/v1/')) {
      return;
    }

    const apiKey = request.headers[API_KEY_HEADER] as string || 
                   (request.headers.authorization?.startsWith(BEARER_PREFIX) 
                     ? request.headers.authorization.substring(BEARER_PREFIX.length) 
                     : null);

    if (!apiKey) {
      throw fastify.createAuthError('API key required for this endpoint');
    }

    const validation = await apiKeyService.validateApiKey(apiKey);

    if (!validation.isValid) {
      // Log security event
      await fastify.dbUtils.query(
        `INSERT INTO audit_logs (action, resource_type, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'API_KEY_INVALID_ATTEMPT',
          'API_KEY',
          request.ip,
          request.headers['user-agent'],
          { reason: validation.reason, keyPrefix: apiKey.substring(0, 10) },
        ]
      );

      throw fastify.createAuthError(validation.reason || 'Invalid API key');
    }

    // Check quota before allowing request
    const subscriptionService = fastify.subscriptionService;
    if (subscriptionService) {
      const quotaCheck = await subscriptionService.checkQuotaAvailability(
        validation.subscriptionId!,
        100 // Estimated tokens - this should be calculated based on request
      );

      if (!quotaCheck.canProceed) {
        throw fastify.createError(403, quotaCheck.reason || 'Quota exceeded');
      }
    }

    request.apiKey = {
      keyId: validation.keyId!,
      subscriptionId: validation.subscriptionId!,
      userId: validation.userId!,
      allowedModels: validation.allowedModels || [], // NEW: Include allowed models
    };
  });
};

// Plugin for tracking API key usage
const apiKeyUsagePlugin: FastifyPluginAsync = async (fastify) => {
  // Track usage after successful API calls
  fastify.addHook('onResponse', async (request: ApiKeyAuthRequest, reply: FastifyReply) => {
    if (!request.apiKey || reply.statusCode >= 400) {
      return; // Skip tracking for failed requests or non-API-key requests
    }

    try {
      // Extract tokens from response (this would depend on your API structure)
      const requestTokens = 100; // Placeholder - calculate from request
      const responseTokens = 150; // Placeholder - calculate from response
      
      // Log usage
      await fastify.dbUtils.query(
        `INSERT INTO usage_logs (
          subscription_id, api_key_id, model_id, request_tokens, 
          response_tokens, latency_ms, status_code, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          request.apiKey.subscriptionId,
          request.apiKey.keyId,
          'unknown', // Would be extracted from request
          requestTokens,
          responseTokens,
          reply.elapsedTime || 0,
          reply.statusCode,
          {
            endpoint: request.url,
            method: request.method,
            userAgent: request.headers['user-agent'],
          },
        ]
      );

      // Trigger quota check hooks
      if (fastify.subscriptionHooks) {
        await fastify.subscriptionHooks.checkQuotaThresholds(request.apiKey.subscriptionId);
      }

    } catch (error) {
      fastify.log.error(error, 'Failed to track API key usage');
    }
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    requireApiKey(): (request: ApiKeyAuthRequest, reply: FastifyReply) => Promise<void>;
    requireSubscriptionAccess(targetSubscriptionId?: string): (request: ApiKeyAuthRequest, reply: FastifyReply) => Promise<void>;
    requireModelAccess(requestedModel: string): (request: ApiKeyAuthRequest, reply: FastifyReply) => Promise<void>; // NEW: Model access validation
    rateLimitByApiKey(options: {
      max: number;
      timeWindow: string | number;
      keyGenerator?: (request: FastifyRequest) => string;
    }): (request: ApiKeyAuthRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fastifyPlugin(apiKeyAuthPlugin);
export { apiKeyProtectedPlugin, apiKeyUsagePlugin };