import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenService } from '../../../src/services/token.service.js';
import type { FastifyInstance } from 'fastify';
import type { JWTPayload } from '../../../src/types/index.js';

describe('TokenService', () => {
  let service: TokenService;
  let mockFastify: Partial<FastifyInstance>;
  let mockDbUtils: any;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    roles: ['user', 'admin'],
  };

  const mockRefreshTokenDbRow = {
    id: 'token-123',
    user_id: 'user-123',
    token: 'mock-refresh-token-abc123',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    created_at: new Date(),
    revoked_at: null,
    last_used_at: null,
  };

  const mockJWTPayload: JWTPayload = {
    userId: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    roles: ['user', 'admin'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(() => {
    mockDbUtils = {
      query: vi.fn(),
      queryOne: vi.fn(),
      queryMany: vi.fn(),
    };

    mockFastify = {
      dbUtils: mockDbUtils,
      generateToken: vi.fn().mockReturnValue('mock-access-token'),
      verifyToken: vi.fn(),
      config: {
        JWT_EXPIRES_IN: '24h',
      } as any,
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as Partial<FastifyInstance>;

    service = new TokenService(mockFastify as FastifyInstance);
  });

  describe('generateTokenPair', () => {
    it('should generate valid JWT token pair for user', async () => {
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      const result = await service.generateTokenPair(mockUser);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token-abc123');
      expect(result.expiresIn).toBe(24 * 60 * 60); // 24 hours in seconds
      expect(result.refreshExpiresIn).toBe(7 * 24 * 60 * 60); // 7 days in seconds
    });

    it('should include user ID in token payload', async () => {
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      await service.generateTokenPair(mockUser);

      expect(mockFastify.generateToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
        }),
      );
    });

    it('should include roles in token payload', async () => {
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      await service.generateTokenPair(mockUser);

      expect(mockFastify.generateToken).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: ['user', 'admin'],
        }),
      );
    });

    it('should include username and email in token payload', async () => {
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      await service.generateTokenPair(mockUser);

      expect(mockFastify.generateToken).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          email: 'test@example.com',
        }),
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate cryptographically secure token', async () => {
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      const result = await service.generateRefreshToken('user-123');

      expect(result).toBeDefined();
      expect(result.token).toBeTruthy();
      expect(typeof result.token).toBe('string');
    });

    it('should store refresh token in database', async () => {
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      await service.generateRefreshToken('user-123');

      expect(mockDbUtils.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        expect.arrayContaining(['user-123', expect.any(String), expect.any(Date)]),
      );
    });

    it('should set expiration to 7 days in the future', async () => {
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      const result = await service.generateRefreshToken('user-123');

      const expiryDiff = result.expiresAt.getTime() - Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      expect(expiryDiff).toBeGreaterThan(sevenDays - 1000); // Allow 1 second tolerance
      expect(expiryDiff).toBeLessThanOrEqual(sevenDays);
    });

    it('should throw error if token creation fails', async () => {
      mockDbUtils.queryOne.mockResolvedValue(null);

      await expect(service.generateRefreshToken('user-123')).rejects.toThrow(/not found/i);
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new token pair from valid refresh token', async () => {
      const tokenRecordWithUser = {
        ...mockRefreshTokenDbRow,
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
      };

      mockDbUtils.queryOne
        .mockResolvedValueOnce(tokenRecordWithUser) // Validate refresh token
        .mockResolvedValueOnce(mockRefreshTokenDbRow); // Generate new refresh token

      const result = await service.refreshAccessToken('mock-refresh-token-abc123');

      expect(result).toBeDefined();
      expect(result?.accessToken).toBe('mock-access-token');
    });

    it('should return null for expired refresh token', async () => {
      mockDbUtils.queryOne.mockResolvedValue(null); // Token not found or expired

      const result = await service.refreshAccessToken('expired-token');

      expect(result).toBeNull();
    });

    it('should return null for revoked refresh token', async () => {
      mockDbUtils.queryOne.mockResolvedValue(null); // Revoked tokens not returned

      const result = await service.refreshAccessToken('revoked-token');

      expect(result).toBeNull();
    });

    it('should return null for inactive user', async () => {
      mockDbUtils.queryOne.mockResolvedValue(null); // User inactive

      const result = await service.refreshAccessToken('valid-token');

      expect(result).toBeNull();
    });

    it('should update last used timestamp', async () => {
      const tokenRecordWithUser = {
        ...mockRefreshTokenDbRow,
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
      };

      mockDbUtils.queryOne
        .mockResolvedValueOnce(tokenRecordWithUser)
        .mockResolvedValueOnce(mockRefreshTokenDbRow);

      await service.refreshAccessToken('mock-refresh-token-abc123');

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET last_used_at'),
        [String(tokenRecordWithUser.id)],
      );
    });

    it('should handle array and single role formats', async () => {
      const tokenWithSingleRole = {
        ...mockRefreshTokenDbRow,
        username: 'testuser',
        email: 'test@example.com',
        roles: 'user', // Single role as string
      };

      mockDbUtils.queryOne
        .mockResolvedValueOnce(tokenWithSingleRole)
        .mockResolvedValueOnce(mockRefreshTokenDbRow);

      await service.refreshAccessToken('mock-refresh-token-abc123');

      expect(mockFastify.generateToken).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: ['user'],
        }),
      );
    });
  });

  describe('validateToken', () => {
    it('should validate authentic token', async () => {
      vi.mocked(mockFastify.verifyToken!).mockResolvedValue(mockJWTPayload);
      mockDbUtils.queryOne.mockResolvedValue({ is_active: true });

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(mockJWTPayload);
      expect(mockFastify.verifyToken).toHaveBeenCalledWith('valid-token');
    });

    it('should reject token for inactive user', async () => {
      vi.mocked(mockFastify.verifyToken!).mockResolvedValue(mockJWTPayload);
      mockDbUtils.queryOne.mockResolvedValue({ is_active: false });

      const result = await service.validateToken('valid-token');

      expect(result).toBeNull();
    });

    it('should reject invalid token signature', async () => {
      vi.mocked(mockFastify.verifyToken!).mockRejectedValue(new Error('Invalid signature'));

      const result = await service.validateToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should reject malformed token', async () => {
      vi.mocked(mockFastify.verifyToken!).mockRejectedValue(new Error('Malformed token'));

      const result = await service.validateToken('malformed-token');

      expect(result).toBeNull();
    });

    it('should extract user data from valid token', async () => {
      vi.mocked(mockFastify.verifyToken!).mockResolvedValue(mockJWTPayload);
      mockDbUtils.queryOne.mockResolvedValue({ is_active: true });

      const result = await service.validateToken('valid-token');

      expect(result).toMatchObject({
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user', 'admin'],
      });
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke single refresh token', async () => {
      mockDbUtils.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.revokeRefreshToken('token-to-revoke');

      expect(result).toBe(true);
      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET revoked_at'),
        ['token-to-revoke'],
      );
    });

    it('should return false for non-existent token', async () => {
      mockDbUtils.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.revokeRefreshToken('non-existent-token');

      expect(result).toBe(false);
    });

    it('should not revoke already-revoked token', async () => {
      mockDbUtils.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.revokeRefreshToken('already-revoked');

      expect(result).toBe(false);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for user', async () => {
      mockDbUtils.query.mockResolvedValue({ rowCount: 3 });

      const result = await service.revokeAllUserTokens('user-123');

      expect(result).toBe(3);
      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET revoked_at'),
        ['user-123'],
      );
    });

    it('should return 0 when user has no active tokens', async () => {
      mockDbUtils.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.revokeAllUserTokens('user-without-tokens');

      expect(result).toBe(0);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      mockDbUtils.query.mockResolvedValue({ rowCount: 5 });

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        [],
      );
    });

    it('should delete old revoked tokens (>30 days)', async () => {
      mockDbUtils.query.mockResolvedValue({ rowCount: 2 });

      await service.cleanupExpiredTokens();

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '30 days'"),
        [],
      );
    });

    it('should return 0 when no tokens to clean up', async () => {
      mockDbUtils.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(0);
    });
  });

  describe('getUserRefreshTokens', () => {
    it('should retrieve all active refresh tokens for user', async () => {
      const tokens = [
        mockRefreshTokenDbRow,
        { ...mockRefreshTokenDbRow, id: 'token-456', token: 'another-token' },
      ];
      mockDbUtils.queryMany.mockResolvedValue(tokens);

      const result = await service.getUserRefreshTokens('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user-123');
      expect(mockDbUtils.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, user_id, token'),
        ['user-123'],
      );
    });

    it('should exclude revoked tokens', async () => {
      mockDbUtils.queryMany.mockResolvedValue([mockRefreshTokenDbRow]);

      await service.getUserRefreshTokens('user-123');

      expect(mockDbUtils.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('revoked_at IS NULL'),
        ['user-123'],
      );
    });

    it('should order by created_at DESC', async () => {
      mockDbUtils.queryMany.mockResolvedValue([]);

      await service.getUserRefreshTokens('user-123');

      expect(mockDbUtils.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        ['user-123'],
      );
    });

    it('should return empty array when user has no tokens', async () => {
      mockDbUtils.queryMany.mockResolvedValue([]);

      const result = await service.getUserRefreshTokens('user-without-tokens');

      expect(result).toEqual([]);
    });
  });

  describe('Token Expiry Parsing', () => {
    it('should parse hours correctly (24h)', async () => {
      mockFastify.config!.JWT_EXPIRES_IN = '24h';
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      const result = await service.generateTokenPair(mockUser);

      expect(result.expiresIn).toBe(24 * 60 * 60); // 24 hours in seconds
    });

    it('should parse days correctly (7d)', async () => {
      mockFastify.config!.JWT_EXPIRES_IN = '7d';
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      const result = await service.generateTokenPair(mockUser);

      expect(result.expiresIn).toBe(7 * 24 * 60 * 60); // 7 days in seconds
    });

    it('should parse minutes correctly (30m)', async () => {
      mockFastify.config!.JWT_EXPIRES_IN = '30m';
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      const result = await service.generateTokenPair(mockUser);

      expect(result.expiresIn).toBe(30 * 60); // 30 minutes in seconds
    });

    it('should parse seconds correctly (3600s)', async () => {
      mockFastify.config!.JWT_EXPIRES_IN = '3600s';
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      const result = await service.generateTokenPair(mockUser);

      expect(result.expiresIn).toBe(3600); // 3600 seconds
    });

    it('should default to seconds for numeric-only values', async () => {
      mockFastify.config!.JWT_EXPIRES_IN = '7200';
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      const result = await service.generateTokenPair(mockUser);

      expect(result.expiresIn).toBe(7200); // 7200 seconds
    });

    it('should handle invalid format gracefully', async () => {
      mockFastify.config!.JWT_EXPIRES_IN = ''; // Empty string
      mockDbUtils.queryOne.mockResolvedValue(mockRefreshTokenDbRow);

      const result = await service.generateTokenPair(mockUser);

      expect(result.expiresIn).toBe(3600); // Default 1 hour when parseInt returns falsy
    });
  });
});
