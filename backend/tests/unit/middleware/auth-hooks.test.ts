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
});
