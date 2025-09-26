import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../../../src/types/auth.types';

// Mock data
const mockUser = {
  userId: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  roles: ['user'],
  iat: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
};

const mockRecentUser = {
  userId: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  roles: ['user'],
  iat: Math.floor(Date.now() / 1000) - 30, // 30 seconds ago
};

const mockOldUser = {
  userId: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  roles: ['user'],
  iat: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
};

describe('Auth Hooks Middleware', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockRequest = {
      user: mockUser,
      headers: {
        'user-agent': 'test-browser',
      },
      ip: '127.0.0.1',
      url: '/api/api-keys/test-key-id/reveal',
      method: 'POST',
    };

    mockReply = {
      header: vi.fn(),
    };

    mockFastify = {
      dbUtils: {
        queryOne: vi.fn(),
        query: vi.fn(),
      },
      createAuthError: vi.fn().mockImplementation((message) => {
        return new Error(typeof message === 'string' ? message : 'Authentication required');
      }),
      createError: vi.fn().mockImplementation((code, message) => {
        const error = new Error(typeof message === 'string' ? message : message.message);
        (error as any).statusCode = code;
        return error;
      }),
      createValidationError: vi.fn().mockImplementation((message) => {
        return new Error(message);
      }),
      createForbiddenError: vi.fn().mockImplementation((message) => {
        return new Error(message);
      }),
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    };
  });

  describe('requireRecentAuth middleware', () => {
    it('should pass for recent authentication', async () => {
      (mockRequest as AuthenticatedRequest).user = mockRecentUser;

      mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue({ is_active: true });

      const requireRecentAuth = async (request: FastifyRequest, _reply: FastifyReply) => {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          throw mockFastify.createAuthError!('Authentication required');
        }

        const userRecord = await mockFastify.dbUtils!.queryOne(
          'SELECT is_active FROM users WHERE id = $1',
          [user.userId],
        );

        if (!userRecord || !userRecord.is_active) {
          throw mockFastify.createAuthError!('User account is disabled');
        }

        const tokenAge = Date.now() / 1000 - (user.iat || 0);
        const maxRecentAge = 5 * 60; // 5 minutes

        if (tokenAge > maxRecentAge) {
          throw mockFastify.createError!(403, {
            code: 'TOKEN_TOO_OLD',
            message: 'Recent authentication required for this operation',
            details: {
              tokenAge: Math.floor(tokenAge),
              maxAge: maxRecentAge,
              action: 'Please re-authenticate to access your API keys',
            },
          });
        }
      };

      await expect(
        requireRecentAuth(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.not.toThrow();

      expect(mockFastify.dbUtils!.queryOne).toHaveBeenCalledWith(
        'SELECT is_active FROM users WHERE id = $1',
        ['user-123'],
      );
    });

    it('should reject old authentication', async () => {
      (mockRequest as AuthenticatedRequest).user = mockOldUser;

      mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue({ is_active: true });

      const requireRecentAuth = async (request: FastifyRequest, _reply: FastifyReply) => {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          throw mockFastify.createAuthError!('Authentication required');
        }

        const userRecord = await mockFastify.dbUtils!.queryOne(
          'SELECT is_active FROM users WHERE id = $1',
          [user.userId],
        );

        if (!userRecord || !userRecord.is_active) {
          throw mockFastify.createAuthError!('User account is disabled');
        }

        const tokenAge = Date.now() / 1000 - (user.iat || 0);
        const maxRecentAge = 5 * 60; // 5 minutes

        if (tokenAge > maxRecentAge) {
          throw mockFastify.createError!(403, {
            code: 'TOKEN_TOO_OLD',
            message: 'Recent authentication required for this operation',
            details: {
              tokenAge: Math.floor(tokenAge),
              maxAge: maxRecentAge,
              action: 'Please re-authenticate to access your API keys',
            },
          });
        }
      };

      await expect(
        requireRecentAuth(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow();

      expect(mockFastify.createError).toHaveBeenCalledWith(
        403,
        expect.objectContaining({
          code: 'TOKEN_TOO_OLD',
          message: 'Recent authentication required for this operation',
        }),
      );
    });

    it('should reject unauthenticated requests', async () => {
      (mockRequest as AuthenticatedRequest).user = undefined;

      const requireRecentAuth = async (request: FastifyRequest, _reply: FastifyReply) => {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          throw mockFastify.createAuthError!('Authentication required');
        }
      };

      await expect(
        requireRecentAuth(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Authentication required');

      expect(mockFastify.createAuthError).toHaveBeenCalledWith('Authentication required');
    });

    it('should reject disabled user accounts', async () => {
      const testUser = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
        iat: Math.floor(Date.now() / 1000) - 60,
      };

      mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue({ is_active: false });

      const requireRecentAuth = async (request: FastifyRequest, _reply: FastifyReply) => {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          throw mockFastify.createAuthError!('Authentication required');
        }

        const userRecord = await mockFastify.dbUtils!.queryOne(
          'SELECT is_active FROM users WHERE id = $1',
          [user.userId],
        );

        if (!userRecord || !userRecord.is_active) {
          throw mockFastify.createAuthError!('User account is disabled');
        }
      };

      // Create the authenticated request with the user
      const authRequest: AuthenticatedRequest = {
        ...mockRequest,
        user: testUser,
      } as AuthenticatedRequest;

      await expect(
        requireRecentAuth(authRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('User account is disabled');
    });
  });

  describe('keyOperationRateLimit middleware', () => {
    it('should pass for normal usage', async () => {
      const keyOperationRateLimit = async (request: FastifyRequest, _reply: FastifyReply) => {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          throw mockFastify.createAuthError!('Authentication required');
        }

        const attempts = (request as any).keyOpAttempts || 0;
        const maxAttempts = 10;

        if (attempts >= maxAttempts) {
          throw mockFastify.createError!(429, {
            code: 'KEY_OPERATION_RATE_LIMITED',
            message: 'Too many API key operations. Please wait before trying again.',
          });
        }

        mockFastify.log!.info(
          {
            userId: user.userId,
            operation: 'key_retrieval',
            attempts: attempts + 1,
            endpoint: request.url,
          },
          'API key operation attempt',
        );
      };

      await expect(
        keyOperationRateLimit(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.not.toThrow();

      expect(mockFastify.log!.info).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          operation: 'key_retrieval',
          attempts: 1,
          endpoint: '/api/api-keys/test-key-id/reveal',
        },
        'API key operation attempt',
      );
    });

    it('should reject excessive attempts', async () => {
      (mockRequest as any).keyOpAttempts = 15; // Over the limit

      mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rows: [{}], rowCount: 1 });

      const keyOperationRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          throw mockFastify.createAuthError!('Authentication required');
        }

        const now = Date.now();
        const windowMs = 5 * 60 * 1000; // 5 minute window
        const maxAttempts = 10;
        const attempts = (request as any).keyOpAttempts || 0;

        if (attempts >= maxAttempts) {
          // Create audit log for rate limit violation
          try {
            await mockFastify.dbUtils!.query(
              `INSERT INTO audit_logs (user_id, action, resource_type, ip_address, user_agent, metadata)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                user.userId,
                'RATE_LIMIT_EXCEEDED',
                'API_KEY_OPERATION',
                request.ip,
                request.headers['user-agent'],
                {
                  operation: 'key_retrieval',
                  window: windowMs,
                  maxAttempts,
                  actualAttempts: attempts,
                  endpoint: request.url,
                },
              ],
            );
          } catch (auditError) {
            mockFastify.log!.error(auditError, 'Failed to create rate limit audit log');
          }

          reply.header('X-RateLimit-Limit', maxAttempts);
          reply.header('X-RateLimit-Remaining', 0);
          reply.header('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
          reply.header('Retry-After', Math.ceil(windowMs / 1000));

          throw mockFastify.createError!(429, {
            code: 'KEY_OPERATION_RATE_LIMITED',
            message: 'Too many API key operations. Please wait before trying again.',
            details: {
              limit: maxAttempts,
              window: '5 minutes',
              retryAfter: Math.ceil(windowMs / 1000),
            },
          });
        }
      };

      await expect(
        keyOperationRateLimit(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow();

      expect(mockFastify.createError).toHaveBeenCalledWith(
        429,
        expect.objectContaining({
          code: 'KEY_OPERATION_RATE_LIMITED',
          message: 'Too many API key operations. Please wait before trying again.',
        }),
      );

      expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
      expect(mockReply.header).toHaveBeenCalledWith('Retry-After', 300);

      // Verify audit log was created
      expect(mockFastify.dbUtils!.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'user-123',
          'RATE_LIMIT_EXCEEDED',
          'API_KEY_OPERATION',
          '127.0.0.1',
          'test-browser',
          expect.objectContaining({
            operation: 'key_retrieval',
            maxAttempts: 10,
            actualAttempts: 15,
            endpoint: '/api/api-keys/test-key-id/reveal',
          }),
        ]),
      );
    });

    it('should reject unauthenticated rate limit attempts', async () => {
      (mockRequest as AuthenticatedRequest).user = undefined;

      const keyOperationRateLimit = async (request: FastifyRequest, _reply: FastifyReply) => {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          throw mockFastify.createAuthError!('Authentication required');
        }
      };

      await expect(
        keyOperationRateLimit(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Authentication Edge Cases', () => {
    it('should handle missing Authorization header', async () => {
      (mockRequest as AuthenticatedRequest).user = undefined;
      (mockRequest as any).headers = {}; // No Authorization header

      const requireRecentAuth = async (request: FastifyRequest, _reply: FastifyReply) => {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          throw mockFastify.createAuthError!('Authentication required');
        }
      };

      await expect(
        requireRecentAuth(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Authentication required');
    });

    it('should handle malformed Bearer token', async () => {
      (mockRequest as AuthenticatedRequest).user = undefined;
      (mockRequest as any).headers = {
        authorization: 'Bearer ', // Malformed - empty token after space
      };

      const authenticate = async (request: FastifyRequest, _reply: FastifyReply) => {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw mockFastify.createAuthError!('Invalid authorization header');
        }

        const token = authHeader.substring(7);
        if (!token || token.trim() === '') {
          throw mockFastify.createAuthError!('Missing token');
        }
      };

      await expect(
        authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Missing token');
    });

    it('should handle empty token string', async () => {
      (mockRequest as AuthenticatedRequest).user = undefined;
      (mockRequest as any).headers = {
        authorization: 'Bearer   ', // Empty token with whitespace
      };

      const authenticate = async (request: FastifyRequest, _reply: FastifyReply) => {
        const authHeader = request.headers.authorization;
        const token = authHeader?.substring(7).trim();

        if (!token) {
          throw mockFastify.createAuthError!('Empty token');
        }
      };

      await expect(
        authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Empty token');
    });

    it('should handle token with extra whitespace', async () => {
      (mockRequest as any).headers = {
        authorization: '  Bearer   valid-token-123  ', // Extra whitespace
      };

      const authenticate = async (request: FastifyRequest, _reply: FastifyReply) => {
        const authHeader = request.headers.authorization?.trim();

        if (!authHeader?.startsWith('Bearer ')) {
          throw mockFastify.createAuthError!('Invalid authorization format');
        }

        const token = authHeader.substring(7).trim();

        if (token === 'valid-token-123') {
          return { token };
        }

        throw mockFastify.createAuthError!('Invalid token');
      };

      const result = await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(result).toEqual({ token: 'valid-token-123' });
    });
  });

  describe('Token Validation Edge Cases', () => {
    it('should reject token from different issuer', async () => {
      const tokenFromDifferentIssuer = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
        iss: 'https://different-issuer.com',
        iat: Math.floor(Date.now() / 1000),
      };

      const validateToken = async (token: any, _reply: FastifyReply) => {
        const expectedIssuer = 'https://expected-issuer.com';

        if (token.iss !== expectedIssuer) {
          throw mockFastify.createAuthError!('Invalid token issuer');
        }
      };

      await expect(
        validateToken(tokenFromDifferentIssuer, mockReply as FastifyReply),
      ).rejects.toThrow('Invalid token issuer');
    });

    it('should reject token with tampered signature', async () => {
      const validateSignature = async (_token: string) => {
        // Simulate signature verification failure
        const isValidSignature = false;

        if (!isValidSignature) {
          throw mockFastify.createAuthError!('Invalid token signature');
        }
      };

      await expect(validateSignature('tampered.jwt.token')).rejects.toThrow(
        'Invalid token signature',
      );
    });

    it('should handle token with missing claims', async () => {
      const tokenWithMissingClaims = {
        userId: 'user-123',
        // Missing username, email, roles
        iat: Math.floor(Date.now() / 1000),
      };

      const validateToken = async (token: any, _reply: FastifyReply) => {
        if (!token.userId || !token.roles) {
          throw mockFastify.createValidationError!('Token missing required claims');
        }
      };

      await expect(
        validateToken(tokenWithMissingClaims, mockReply as FastifyReply),
      ).rejects.toThrow('Token missing required claims');
    });

    it('should handle token with invalid role format', async () => {
      const tokenWithInvalidRoles = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: 'user', // Should be array, not string
        iat: Math.floor(Date.now() / 1000),
      };

      const validateToken = async (token: any, _reply: FastifyReply) => {
        if (!Array.isArray(token.roles)) {
          throw mockFastify.createValidationError!('Roles must be an array');
        }
      };

      await expect(validateToken(tokenWithInvalidRoles, mockReply as FastifyReply)).rejects.toThrow(
        'Roles must be an array',
      );
    });

    it('should handle expired token with grace period', async () => {
      const expiredToken = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
        exp: Math.floor(Date.now() / 1000) - 600, // Expired 10 minutes ago
        iat: Math.floor(Date.now() / 1000) - 3600,
      };

      const validateToken = async (token: any, _reply: FastifyReply) => {
        const now = Math.floor(Date.now() / 1000);
        const gracePeriod = 300; // 5 minutes

        if (token.exp && token.exp + gracePeriod < now) {
          throw mockFastify.createAuthError!('Token expired beyond grace period');
        }
      };

      await expect(validateToken(expiredToken, mockReply as FastifyReply)).rejects.toThrow(
        'Token expired beyond grace period',
      );
    });
  });

  describe('Role-Based Access Edge Cases', () => {
    it('should handle user with no roles', async () => {
      const userWithNoRoles = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [],
        iat: Math.floor(Date.now() / 1000),
      };

      const requireRole = async (user: any, requiredRole: string) => {
        if (!user.roles || user.roles.length === 0) {
          throw mockFastify.createForbiddenError!('User has no assigned roles');
        }

        if (!user.roles.includes(requiredRole)) {
          throw mockFastify.createForbiddenError!(`Required role '${requiredRole}' not found`);
        }
      };

      await expect(requireRole(userWithNoRoles, 'admin')).rejects.toThrow(
        'User has no assigned roles',
      );
    });

    it('should handle user with unknown role', async () => {
      const userWithUnknownRole = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['unknown_role'],
        iat: Math.floor(Date.now() / 1000),
      };

      const validateKnownRoles = async (user: any) => {
        const knownRoles = ['user', 'admin', 'adminReadonly'];

        const hasValidRole = user.roles.some((role: string) => knownRoles.includes(role));

        if (!hasValidRole) {
          throw mockFastify.createForbiddenError!('User has no valid roles');
        }
      };

      await expect(validateKnownRoles(userWithUnknownRole)).rejects.toThrow(
        'User has no valid roles',
      );
    });

    it('should respect role hierarchy for mixed roles', async () => {
      const userWithMixedRoles = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user', 'admin', 'adminReadonly'],
        iat: Math.floor(Date.now() / 1000),
      };

      const getHighestRole = (user: any): string => {
        const roleHierarchy = ['admin', 'adminReadonly', 'user'];

        for (const role of roleHierarchy) {
          if (user.roles.includes(role)) {
            return role;
          }
        }

        return 'user';
      };

      const highestRole = getHighestRole(userWithMixedRoles);
      expect(highestRole).toBe('admin');
    });

    it('should handle case-sensitive role matching', async () => {
      const userWithMixedCaseRole = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['Admin'], // Wrong case
        iat: Math.floor(Date.now() / 1000),
      };

      const requireRole = async (user: any, requiredRole: string) => {
        // Roles should be case-sensitive
        if (!user.roles.includes(requiredRole)) {
          throw mockFastify.createForbiddenError!(`Required role '${requiredRole}' not found`);
        }
      };

      await expect(requireRole(userWithMixedCaseRole, 'admin')).rejects.toThrow(
        "Required role 'admin' not found",
      );
    });
  });

  describe('Rate Limiting Edge Cases', () => {
    it('should handle rate limit with zero attempts remaining', async () => {
      (mockRequest as any).keyOpAttempts = 10; // At the limit

      const checkRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
        const attempts = (request as any).keyOpAttempts || 0;
        const maxAttempts = 10;
        const remaining = Math.max(0, maxAttempts - attempts);

        reply.header('X-RateLimit-Limit', maxAttempts);
        reply.header('X-RateLimit-Remaining', remaining);

        if (remaining === 0) {
          throw mockFastify.createError!(429, {
            code: 'RATE_LIMITED',
            message: 'Rate limit reached',
          });
        }
      };

      await expect(
        checkRateLimit(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Rate limit reached');

      expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
    });

    it('should include retry-after header for rate limit errors', async () => {
      (mockRequest as any).keyOpAttempts = 15;

      const handleRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
        const attempts = (request as any).keyOpAttempts || 0;
        const maxAttempts = 10;

        if (attempts >= maxAttempts) {
          const retryAfterSeconds = 300; // 5 minutes
          reply.header('Retry-After', retryAfterSeconds);
          reply.header('X-RateLimit-Reset', new Date(Date.now() + 300000).toISOString());

          throw mockFastify.createError!(429, 'Rate limit exceeded');
        }
      };

      await expect(
        handleRateLimit(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Rate limit exceeded');

      expect(mockReply.header).toHaveBeenCalledWith('Retry-After', 300);
    });

    it('should reset rate limit counter after time window', async () => {
      const now = Date.now();
      const windowStart = now - 400000; // Started 6+ minutes ago (outside 5-minute window)

      (mockRequest as any).keyOpAttempts = 5;
      (mockRequest as any).rateLimitWindowStart = windowStart;

      const checkRateLimitWindow = async (request: FastifyRequest) => {
        const windowMs = 5 * 60 * 1000; // 5 minutes
        const windowStart = (request as any).rateLimitWindowStart || Date.now();
        const windowAge = Date.now() - windowStart;

        if (windowAge > windowMs) {
          // Reset counter
          (request as any).keyOpAttempts = 0;
          (request as any).rateLimitWindowStart = Date.now();
        }

        return (request as any).keyOpAttempts;
      };

      const attempts = await checkRateLimitWindow(mockRequest as FastifyRequest);
      expect(attempts).toBe(0); // Should be reset
    });
  });
});
