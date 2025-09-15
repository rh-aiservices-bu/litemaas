import { FastifyInstance } from 'fastify';
import { JWTPayload } from '../types';
import { BaseService } from './base.service';

export interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
  lastUsedAt?: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export class TokenService extends BaseService {
  private refreshTokenExpiry: number = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  async generateTokenPair(user: {
    id: string;
    username: string;
    email: string;
    roles: string[];
  }): Promise<TokenPair> {
    // Generate access token (short-lived)
    const accessTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.fastify.generateToken(accessTokenPayload);

    // Generate refresh token (long-lived)
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken: refreshToken.token,
      expiresIn: this.getAccessTokenExpiry(),
      refreshExpiresIn: Math.floor(this.refreshTokenExpiry / 1000),
    };
  }

  async generateRefreshToken(userId: string): Promise<RefreshToken> {
    // Generate cryptographically secure random token
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiry);

    // Store refresh token in database
    const refreshTokenResult = await this.fastify.dbUtils.queryOne(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, token, expires_at, created_at`,
      [userId, token, expiresAt],
    );

    if (!refreshTokenResult) {
      throw this.createNotFoundError(
        'Refresh token',
        userId,
        'Failed to create refresh token for user. Please try logging in again',
      );
    }

    return {
      id: String(refreshTokenResult.id),
      userId: String(refreshTokenResult.user_id),
      token: String(refreshTokenResult.token),
      expiresAt: new Date(refreshTokenResult.expires_at as string),
      createdAt: new Date(refreshTokenResult.created_at as string),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
    // Validate refresh token
    const tokenRecord = await this.fastify.dbUtils.queryOne(
      `SELECT rt.*, u.username, u.email, u.roles
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = $1 
         AND rt.expires_at > NOW()
         AND rt.revoked_at IS NULL
         AND u.is_active = true`,
      [refreshToken],
    );

    if (!tokenRecord) {
      return null;
    }

    // Update last used timestamp
    await this.fastify.dbUtils.query(
      'UPDATE refresh_tokens SET last_used_at = NOW() WHERE id = $1',
      [String(tokenRecord.id)],
    );

    // Generate new token pair
    return this.generateTokenPair({
      id: String(tokenRecord.user_id),
      username: String(tokenRecord.username),
      email: String(tokenRecord.email),
      roles: Array.isArray(tokenRecord.roles)
        ? (tokenRecord.roles as string[])
        : [String(tokenRecord.roles)],
    });
  }

  async revokeRefreshToken(token: string): Promise<boolean> {
    const result = await this.fastify.dbUtils.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1 AND revoked_at IS NULL',
      [token],
    );

    return result.rowCount > 0;
  }

  async revokeAllUserTokens(userId: string): Promise<number> {
    const result = await this.fastify.dbUtils.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId],
    );

    return result.rowCount;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.fastify.dbUtils.query(
      "DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '30 days'",
      [],
    );

    return result.rowCount;
  }

  async validateToken(token: string): Promise<JWTPayload | null> {
    try {
      const payload = await this.fastify.verifyToken(token);

      // Additional validation: check if user is still active
      const user = await this.fastify.dbUtils.queryOne(
        'SELECT is_active FROM users WHERE id = $1',
        [payload.userId],
      );

      if (!user || !user.is_active) {
        return null;
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  async getUserRefreshTokens(userId: string): Promise<RefreshToken[]> {
    const tokens = await this.fastify.dbUtils.queryMany(
      `SELECT id, user_id, token, expires_at, created_at, revoked_at, last_used_at
       FROM refresh_tokens
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [userId],
    );

    return tokens.map((token) => ({
      id: String(token.id),
      userId: String(token.user_id),
      token: String(token.token),
      expiresAt: new Date(token.expires_at as string),
      createdAt: new Date(token.created_at as string),
      revokedAt: token.revoked_at ? new Date(token.revoked_at as string) : undefined,
      lastUsedAt: token.last_used_at ? new Date(token.last_used_at as string) : undefined,
    }));
  }

  private generateSecureToken(): string {
    // Generate 32 bytes of random data and encode as base64url
    const buffer = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(buffer);
    } else {
      // Fallback for Node.js
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const crypto = require('crypto');
      const randomBytes = crypto.randomBytes(32);
      buffer.set(randomBytes);
    }

    // Convert to base64url (URL-safe base64)
    return Buffer.from(buffer)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private getAccessTokenExpiry(): number {
    // Parse JWT_EXPIRES_IN (e.g., "24h", "1d", "3600s")
    const expiresIn = this.fastify.config.JWT_EXPIRES_IN;

    if (expiresIn.endsWith('h')) {
      return parseInt(expiresIn) * 60 * 60;
    } else if (expiresIn.endsWith('d')) {
      return parseInt(expiresIn) * 24 * 60 * 60;
    } else if (expiresIn.endsWith('m')) {
      return parseInt(expiresIn) * 60;
    } else if (expiresIn.endsWith('s')) {
      return parseInt(expiresIn);
    } else {
      // Default to seconds
      return parseInt(expiresIn) || 3600;
    }
  }
}
