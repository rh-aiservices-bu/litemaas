import { FastifyInstance } from 'fastify';

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  refreshToken?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface SessionInfo {
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivityAt: Date;
  isCurrent: boolean;
}

export class SessionService {
  private fastify: FastifyInstance;
  private sessionStore: Map<string, UserSession> = new Map();
  private readonly maxSessionsPerUser = 10;
  private readonly sessionTimeoutMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;

    // Clean up expired sessions every 30 minutes
    setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      30 * 60 * 1000,
    );
  }

  async createSession(
    user: {
      id: string;
      username: string;
      email: string;
      roles: string[];
    },
    ipAddress: string,
    userAgent: string,
  ): Promise<{
    sessionId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    // Generate tokens
    const tokenPair = await this.fastify.generateTokenPair(user);
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTimeoutMs);

    // Create session object
    const session: UserSession = {
      id: sessionId,
      userId: user.id,
      token: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      ipAddress,
      userAgent,
      createdAt: now,
      lastActivityAt: now,
      expiresAt,
      isActive: true,
    };

    // Store session in memory (in production, use Redis)
    this.sessionStore.set(sessionId, session);

    // Store session in database for persistence
    await this.fastify.dbUtils.query(
      `INSERT INTO user_sessions (id, user_id, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, user.id, ipAddress, userAgent, expiresAt],
    );

    // Cleanup old sessions for this user
    await this.cleanupUserSessions(user.id);

    this.fastify.log.info(
      {
        userId: user.id,
        sessionId,
        ipAddress,
      },
      'Session created',
    );

    return {
      sessionId,
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
    };
  }

  async refreshSession(
    sessionId: string,
    refreshToken: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } | null> {
    const session = this.sessionStore.get(sessionId);

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return null;
    }

    // Verify refresh token
    const tokenPair = await this.fastify.refreshToken(refreshToken);

    if (!tokenPair) {
      await this.invalidateSession(sessionId);
      return null;
    }

    // Update session with new tokens
    session.token = tokenPair.accessToken;
    session.refreshToken = tokenPair.refreshToken;
    session.lastActivityAt = new Date();

    // Update in database
    await this.fastify.dbUtils.query(
      'UPDATE user_sessions SET last_activity_at = NOW() WHERE id = $1',
      [sessionId],
    );

    this.fastify.log.debug(
      {
        sessionId,
        userId: session.userId,
      },
      'Session refreshed',
    );

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
    };
  }

  async validateSession(sessionId: string): Promise<UserSession | null> {
    const session = this.sessionStore.get(sessionId);

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      if (session) {
        await this.invalidateSession(sessionId);
      }
      return null;
    }

    // Update last activity
    session.lastActivityAt = new Date();

    return session;
  }

  async invalidateSession(sessionId: string): Promise<boolean> {
    const session = this.sessionStore.get(sessionId);

    if (!session) {
      return false;
    }

    // Mark as inactive
    session.isActive = false;

    // Remove from memory store
    this.sessionStore.delete(sessionId);

    // Revoke refresh token
    if (session.refreshToken) {
      await this.fastify.tokenService.revokeRefreshToken(session.refreshToken);
    }

    // Update database
    await this.fastify.dbUtils.query(
      'UPDATE user_sessions SET is_active = false, ended_at = NOW() WHERE id = $1',
      [sessionId],
    );

    this.fastify.log.info(
      {
        sessionId,
        userId: session.userId,
      },
      'Session invalidated',
    );

    return true;
  }

  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    // Get sessions from database
    const sessions = await this.fastify.dbUtils.queryMany(
      `SELECT id, ip_address, user_agent, created_at, last_activity_at, is_active
       FROM user_sessions
       WHERE user_id = $1 AND is_active = true
       ORDER BY last_activity_at DESC`,
      [userId],
    );

    return sessions.map((session) => ({
      sessionId: session.id,
      ipAddress: session.ip_address,
      userAgent: session.user_agent,
      createdAt: session.created_at,
      lastActivityAt: session.last_activity_at || session.created_at,
      isCurrent: this.sessionStore.has(session.id),
    }));
  }

  async invalidateAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    let count = 0;

    // Get all user sessions
    for (const [sessionId, session] of this.sessionStore.entries()) {
      if (session.userId === userId && sessionId !== exceptSessionId) {
        await this.invalidateSession(sessionId);
        count++;
      }
    }

    // Update database
    const result = await this.fastify.dbUtils.query(
      `UPDATE user_sessions 
       SET is_active = false, ended_at = NOW() 
       WHERE user_id = $1 AND is_active = true ${exceptSessionId ? 'AND id != $2' : ''}`,
      exceptSessionId ? [userId, exceptSessionId] : [userId],
    );

    this.fastify.log.info(
      {
        userId,
        invalidatedSessions: count,
        exceptSessionId,
      },
      'Invalidated user sessions',
    );

    return Math.max(count, result.rowCount || 0);
  }

  async getSessionFromRequest(request: any): Promise<UserSession | null> {
    // Try to get session ID from various sources
    let sessionId = request.headers['x-session-id'];

    if (!sessionId && request.user) {
      // Try to find session by user and token
      const token = request.headers.authorization?.replace('Bearer ', '');

      for (const [id, session] of this.sessionStore.entries()) {
        if (session.userId === request.user.userId && session.token === token) {
          sessionId = id;
          break;
        }
      }
    }

    if (!sessionId) {
      return null;
    }

    return this.validateSession(sessionId);
  }

  private async cleanupUserSessions(userId: string): Promise<void> {
    const sessions = await this.fastify.dbUtils.queryMany(
      `SELECT id FROM user_sessions
       WHERE user_id = $1 AND is_active = true
       ORDER BY created_at DESC
       OFFSET $2`,
      [userId, this.maxSessionsPerUser],
    );

    if (sessions.length > 0) {
      const sessionIds = sessions.map((s) => s.id);

      // Invalidate old sessions
      for (const sessionId of sessionIds) {
        await this.invalidateSession(sessionId);
      }
    }
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessionStore.entries()) {
      if (session.expiresAt < now || !session.isActive) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach((sessionId) => {
      this.invalidateSession(sessionId);
    });

    if (expiredSessions.length > 0) {
      this.fastify.log.debug(
        {
          cleanedSessions: expiredSessions.length,
        },
        'Cleaned up expired sessions',
      );
    }
  }

  private generateSessionId(): string {
    // Generate secure session ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}_${random}`;
  }
}

// Database migration for sessions table
export const createSessionsTable = `
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
`;
