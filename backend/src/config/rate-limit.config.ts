/**
 * Rate Limit Configuration for Admin Analytics Endpoints
 *
 * Different limits are applied based on operation cost:
 * - Analytics queries: Moderate cost (database + LiteLLM API aggregation)
 * - Cache rebuild: Very high cost (full data refresh across all dates)
 * - Exports: Moderate-high cost (large data generation and formatting)
 *
 * Rate limits are configurable via environment variables to support different
 * deployment scenarios (development, staging, production).
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the time window */
  max: number;
  /** Time window for rate limiting (e.g., '1 minute', '5 minutes') */
  timeWindow: string;
  /** Size of the cache for storing rate limit counters (number of unique keys) */
  cache?: number;
  /** Whether to skip rate limiting on error */
  skipOnError?: boolean;
  /** Custom key generator function for identifying unique clients */
  keyGenerator?: (request: any) => string;
  /** Error response builder for rate limit exceeded errors */
  errorResponseBuilder?: (request: any, context: any) => any;
}

/**
 * Extract user ID from JWT token in Authorization header
 * Used by rate limit keyGenerator to identify users before authentication middleware runs
 */
const extractUserIdFromToken = (request: any): string | null => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    // Decode JWT without verification (just to extract userId for rate limiting)
    // The actual JWT verification happens in the authenticate middleware
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.userId || payload.sub || null;
  } catch {
    return null;
  }
};

/**
 * Error response builder for rate limit exceeded errors
 * Returns a consistent error format across all rate-limited endpoints
 */
const createErrorResponse = (timeWindow: string) => {
  return (_request: any, context: { max: number; ttl: number }) => ({
    code: 'RATE_LIMITED',
    message: `Too many requests. Limit: ${context.max} per ${timeWindow}`,
  });
};

/**
 * Pre-configured rate limit settings for different endpoint types
 */
export const RATE_LIMITS = {
  /**
   * Analytics endpoints (queries, breakdowns)
   * Default: 10 requests per minute per user
   *
   * These endpoints perform complex database queries and LiteLLM API aggregations.
   * The limit is moderate to allow interactive dashboard usage while preventing abuse.
   */
  analytics: {
    max: Number(process.env.ADMIN_ANALYTICS_RATE_LIMIT) || 10,
    timeWindow: '1 minute',
    cache: 10000, // Cache up to 10k different users
    keyGenerator: (request: any) => {
      const userId = extractUserIdFromToken(request);
      return userId ? `user:${userId}` : `ip:${request.ip}`;
    },
    errorResponseBuilder: createErrorResponse('1 minute'),
  } as RateLimitConfig,

  /**
   * Cache rebuild endpoint
   * Default: 1 request per 5 minutes per user (very restrictive)
   *
   * This endpoint triggers a full cache rebuild across all dates, which is
   * extremely expensive. Very restrictive limit prevents system overload.
   */
  cacheRebuild: {
    max: Number(process.env.ADMIN_CACHE_REBUILD_LIMIT) || 1,
    timeWindow: '5 minutes',
    skipOnError: false, // Always enforce, even on errors
    keyGenerator: (request: any) => {
      const userId = extractUserIdFromToken(request);
      return userId ? `user:${userId}` : `ip:${request.ip}`;
    },
    errorResponseBuilder: createErrorResponse('5 minutes'),
  } as RateLimitConfig,

  /**
   * Export endpoints (CSV/JSON generation)
   * Default: 5 requests per minute per user
   *
   * Export operations generate large datasets and format them for download.
   * Moderate restriction balances usability with resource protection.
   */
  export: {
    max: Number(process.env.ADMIN_EXPORT_RATE_LIMIT) || 5,
    timeWindow: '1 minute',
    cache: 10000,
    keyGenerator: (request: any) => {
      const userId = extractUserIdFromToken(request);
      return userId ? `user:${userId}` : `ip:${request.ip}`;
    },
    errorResponseBuilder: createErrorResponse('1 minute'),
  } as RateLimitConfig,
};

/**
 * Get rate limit configuration for a specific endpoint type
 *
 * @param type - The type of endpoint ('analytics', 'cacheRebuild', or 'export')
 * @returns Rate limit configuration object
 *
 * @example
 * ```typescript
 * import { getRateLimitConfig } from '../config/rate-limit.config';
 *
 * fastify.post('/analytics', {
 *   config: {
 *     rateLimit: getRateLimitConfig('analytics'),
 *   },
 *   handler: async (request, reply) => {
 *     // Handler code
 *   },
 * });
 * ```
 */
export function getRateLimitConfig(type: keyof typeof RATE_LIMITS): RateLimitConfig {
  return RATE_LIMITS[type];
}
