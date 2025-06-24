import { FastifyInstance } from 'fastify';
import { OAuthUserInfo, OAuthTokenResponse } from '../types';

export interface MockUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  groups: string[];
  roles: string[];
}

// Mock users for development
const MOCK_USERS: MockUser[] = [
  {
    id: 'admin-001',
    username: 'admin@example.com',
    email: 'admin@example.com',
    fullName: 'System Administrator',
    groups: ['administrators', 'litemaas-admins'],
    roles: ['admin', 'user'],
  },
  {
    id: 'user-001',
    username: 'user@example.com',
    email: 'user@example.com',
    fullName: 'Regular User',
    groups: ['developers', 'litemaas-users'],
    roles: ['user'],
  },
  {
    id: 'readonly-001',
    username: 'readonly@example.com',
    email: 'readonly@example.com',
    fullName: 'Read Only User',
    groups: ['viewers', 'litemaas-readonly'],
    roles: ['readonly'],
  },
];

export class OAuthService {
  private fastify: FastifyInstance;
  private isMockEnabled: boolean;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.isMockEnabled = process.env.OAUTH_MOCK_ENABLED === 'true' || process.env.NODE_ENV === 'development';
  }

  generateAuthUrl(state: string): string {
    if (this.isMockEnabled) {
      return `/api/auth/mock-login?state=${state}`;
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.fastify.config.OAUTH_CLIENT_ID,
      redirect_uri: this.fastify.config.OAUTH_CALLBACK_URL,
      scope: 'user:info user:check-access',
      state,
    });

    return `${this.fastify.config.OAUTH_ISSUER}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, state: string): Promise<OAuthTokenResponse> {
    if (this.isMockEnabled) {
      return this.mockTokenExchange(code);
    }

    // Real OAuth implementation
    const tokenUrl = `${this.fastify.config.OAUTH_ISSUER}/oauth/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.fastify.config.OAUTH_CLIENT_ID,
        client_secret: this.fastify.config.OAUTH_CLIENT_SECRET,
        redirect_uri: this.fastify.config.OAUTH_CALLBACK_URL,
      }),
    });

    if (!response.ok) {
      throw this.fastify.createError(400, 'Failed to exchange authorization code');
    }

    return await response.json();
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    if (this.isMockEnabled) {
      return this.mockGetUserInfo(accessToken);
    }

    // Real OpenShift user info
    const userInfoUrl = `${this.fastify.config.OAUTH_ISSUER}/apis/user.openshift.io/v1/users/~`;
    
    const response = await fetch(userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw this.fastify.createError(401, 'Failed to get user information');
    }

    const userResponse = await response.json();
    
    return {
      sub: userResponse.metadata.uid,
      preferred_username: userResponse.metadata.name,
      name: userResponse.fullName,
      email: userResponse.metadata.name, // Assuming username is email
      email_verified: true,
      groups: userResponse.groups || [],
    };
  }

  private mockTokenExchange(code: string): OAuthTokenResponse {
    // Decode mock user from code
    const userIndex = parseInt(code) || 0;
    const user = MOCK_USERS[userIndex] || MOCK_USERS[0];

    return {
      access_token: `mock_token_${user.id}`,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'user:info user:check-access',
    };
  }

  private mockGetUserInfo(accessToken: string): OAuthUserInfo {
    // Extract user ID from mock token
    const userId = accessToken.replace('mock_token_', '');
    const user = MOCK_USERS.find(u => u.id === userId) || MOCK_USERS[0];

    return {
      sub: user.id,
      preferred_username: user.username,
      name: user.fullName,
      email: user.email,
      email_verified: true,
      groups: user.groups,
    };
  }

  generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  getMockUsers(): MockUser[] {
    return this.isMockEnabled ? MOCK_USERS : [];
  }

  private mapGroupsToRoles(groups: string[]): string[] {
    const roleMapping: Record<string, string[]> = {
      'litemaas-admins': ['admin', 'user'],
      'administrators': ['admin', 'user'],
      'litemaas-users': ['user'],
      'developers': ['user'],
      'litemaas-readonly': ['readonly'],
      'viewers': ['readonly'],
    };

    const roles = new Set<string>();
    
    for (const group of groups) {
      const mappedRoles = roleMapping[group] || [];
      mappedRoles.forEach(role => roles.add(role));
    }

    return roles.size > 0 ? Array.from(roles) : ['user'];
  }

  async processOAuthUser(userInfo: OAuthUserInfo): Promise<{
    id: string;
    username: string;
    email: string;
    fullName?: string;
    roles: string[];
  }> {
    const roles = this.mapGroupsToRoles(userInfo.groups || []);

    // Check if user exists in database
    const existingUser = await this.fastify.dbUtils.queryOne(
      'SELECT * FROM users WHERE oauth_id = $1 AND oauth_provider = $2',
      [userInfo.sub, 'openshift']
    );

    if (existingUser) {
      // Update existing user
      await this.fastify.dbUtils.query(
        `UPDATE users SET 
         username = $1, email = $2, full_name = $3, roles = $4, last_login_at = NOW(), updated_at = NOW()
         WHERE id = $5`,
        [userInfo.preferred_username, userInfo.email, userInfo.name, roles, existingUser.id]
      );

      return {
        id: existingUser.id,
        username: userInfo.preferred_username,
        email: userInfo.email || userInfo.preferred_username,
        fullName: userInfo.name,
        roles,
      };
    } else {
      // Create new user
      const newUser = await this.fastify.dbUtils.queryOne(
        `INSERT INTO users (username, email, full_name, oauth_provider, oauth_id, roles, last_login_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, username, email, full_name`,
        [
          userInfo.preferred_username,
          userInfo.email || userInfo.preferred_username,
          userInfo.name,
          'openshift',
          userInfo.sub,
          roles,
        ]
      );

      return {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.full_name,
        roles,
      };
    }
  }
}