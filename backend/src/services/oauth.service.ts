import { FastifyInstance } from 'fastify';
import { OAuthUserInfo, OAuthTokenResponse } from '../types';
import { LiteLLMService } from './litellm.service';
import { DefaultTeamService } from './default-team.service';

export interface MockUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  groups: string[];
  roles: string[];
}

interface DatabaseUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
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
  private liteLLMService: LiteLLMService;
  private defaultTeamService: DefaultTeamService;

  constructor(fastify: FastifyInstance, liteLLMService?: LiteLLMService) {
    this.fastify = fastify;
    this.isMockEnabled =
      process.env.OAUTH_MOCK_ENABLED === 'true' || process.env.NODE_ENV === 'development';
    this.liteLLMService = liteLLMService || new LiteLLMService(fastify);
    this.defaultTeamService = new DefaultTeamService(fastify, this.liteLLMService);
  }

  private getCallbackUrl(request?: any): string {
    // If request is provided, try to infer the callback URL from the request
    if (request) {
      const origin =
        request.headers.origin ||
        (request.headers.host ? `${request.protocol}://${request.headers.host}` : null);

      if (origin) {
        // Use the origin from where the request came from
        const callbackUrl = `${origin}/api/auth/callback`;
        this.fastify.log.debug({ origin, callbackUrl }, 'Using dynamic OAuth callback URL');
        return callbackUrl;
      }
    }

    // Fall back to configured callback URL
    return this.fastify.config.OAUTH_CALLBACK_URL;
  }

  generateAuthUrl(state: string, request?: any): string {
    if (this.isMockEnabled) {
      return `/api/auth/mock-login?state=${state}`;
    }

    // Dynamically determine callback URL based on request origin
    const callbackUrl = this.getCallbackUrl(request);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.fastify.config.OAUTH_CLIENT_ID,
      redirect_uri: callbackUrl,
      scope: 'user:info user:check-access',
      state,
    });

    return `${this.fastify.config.OAUTH_ISSUER}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(
    code: string,
    state: string,
    request?: any,
  ): Promise<OAuthTokenResponse> {
    if (this.isMockEnabled) {
      return this.mockTokenExchange(code);
    }

    // Real OAuth implementation
    const tokenUrl = `${this.fastify.config.OAUTH_ISSUER}/oauth/token`;

    this.fastify.log.debug(
      {
        tokenUrl,
        codePreview: code.substring(0, 20) + '...',
        clientId: this.fastify.config.OAUTH_CLIENT_ID,
      },
      'Exchanging code for token',
    );

    // Use the stored callback URL from the authorization phase
    const storedCallbackUrl = (this.fastify as any).oauthHelpers.getStoredCallbackUrl(state);
    const callbackUrl = storedCallbackUrl || this.getCallbackUrl(request);

    this.fastify.log.debug(
      {
        callbackUrl,
        storedCallbackUrl,
        requestHost: request?.headers?.host,
        requestOrigin: request?.headers?.origin,
        configuredCallback: this.fastify.config.OAUTH_CALLBACK_URL,
        state,
      },
      'Token exchange callback URL',
    );

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.fastify.config.OAUTH_CLIENT_ID,
        client_secret: this.fastify.config.OAUTH_CLIENT_SECRET,
        redirect_uri: callbackUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.fastify.log.error(
        {
          status: response.status,
          statusText: response.statusText,
          errorText,
          tokenUrl,
        },
        'Failed to exchange code for token',
      );
      throw this.fastify.createError(400, 'Failed to exchange authorization code');
    }

    const tokenResponse = await response.json();

    this.fastify.log.debug(
      {
        hasAccessToken: !!tokenResponse.access_token,
        tokenType: tokenResponse.token_type,
        expiresIn: tokenResponse.expires_in,
      },
      'Token received from OpenShift',
    );

    return tokenResponse;
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    if (this.isMockEnabled) {
      return this.mockGetUserInfo(accessToken);
    }

    // Real OpenShift user info
    // Convert OAuth issuer URL to API server URL
    // From: https://oauth-openshift.apps.dev.rhoai.rh-aiservices-bu.com
    // To:   https://api.dev.rhoai.rh-aiservices-bu.com:6443
    const oauthIssuer = this.fastify.config.OAUTH_ISSUER;
    let apiServerUrl: string;

    if (oauthIssuer.includes('oauth-openshift.apps.')) {
      // Standard OpenShift pattern
      apiServerUrl =
        oauthIssuer.replace('oauth-openshift.apps.', 'api.').replace(/\/$/, '') + ':6443';
    } else {
      // Fallback: assume the issuer is already the API server
      apiServerUrl = oauthIssuer;
    }

    const userInfoUrl = `${apiServerUrl}/apis/user.openshift.io/v1/users/~`;

    this.fastify.log.debug(
      {
        oauthIssuer,
        apiServerUrl,
        userInfoUrl,
        accessTokenPreview: accessToken.substring(0, 20) + '...',
      },
      'Fetching user info from OpenShift API server',
    );

    const response = await fetch(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.fastify.log.error(
        {
          status: response.status,
          statusText: response.statusText,
          errorText,
          userInfoUrl,
        },
        'Failed to get user info from OpenShift',
      );
      throw this.fastify.createError(401, 'Failed to get user information');
    }

    const userResponse = await response.json();

    this.fastify.log.debug({ userResponse }, 'OpenShift user info received');

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
    const user = MOCK_USERS.find((u) => u.id === userId) || MOCK_USERS[0];

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
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  getMockUsers(): MockUser[] {
    return this.isMockEnabled ? MOCK_USERS : [];
  }

  private mapGroupsToRoles(groups: string[]): string[] {
    const roleMapping: Record<string, string[]> = {
      'litemaas-admins': ['admin', 'user'],
      administrators: ['admin', 'user'],
      'litemaas-users': ['user'],
      developers: ['user'],
      'litemaas-readonly': ['admin-readonly', 'user'],
      viewers: ['admin-readonly', 'user'],
    };

    const roles = new Set<string>();

    // Always add 'user' as base role
    roles.add('user');

    for (const group of groups) {
      const mappedRoles = roleMapping[group] || [];
      mappedRoles.forEach((role) => roles.add(role));
    }

    return Array.from(roles);
  }

  /**
   * Merges existing user roles with OpenShift group-derived roles.
   * Application-set roles take precedence - if a user has been explicitly granted
   * a role through the application, it's preserved even if not in OpenShift groups.
   * OpenShift groups provide additional roles on top of existing ones.
   */
  private mergeRoles(existingRoles: string[], openShiftRoles: string[]): string[] {
    const allRoles = new Set<string>();

    // Always ensure 'user' role is present as base
    allRoles.add('user');

    // Add all existing roles (application-set roles are preserved)
    existingRoles.forEach((role) => allRoles.add(role));

    // Add OpenShift-derived roles (additive, doesn't remove existing roles)
    openShiftRoles.forEach((role) => allRoles.add(role));

    return Array.from(allRoles);
  }

  /**
   * Ensures user is a member of the default team in the database
   */
  private async ensureUserTeamMembership(userId: string, teamId: string): Promise<void> {
    // Use DefaultTeamService for team membership management
    if (teamId === DefaultTeamService.DEFAULT_TEAM_ID) {
      await this.defaultTeamService.assignUserToDefaultTeam(userId);
    } else {
      // For non-default teams, keep the original logic for now
      try {
        const existingMembership = await this.fastify.dbUtils.queryOne(
          'SELECT id FROM team_members WHERE user_id = $1 AND team_id = $2',
          [userId, teamId],
        );

        if (!existingMembership) {
          await this.fastify.dbUtils.query(
            'INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (team_id, user_id) DO NOTHING',
            [teamId, userId, 'member'],
          );

          this.fastify.log.info({ userId, teamId }, 'Successfully added user to team in database');
        }
      } catch (error) {
        this.fastify.log.warn(
          {
            userId,
            teamId,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Failed to ensure user team membership in database',
        );
        throw error;
      }
    }
  }

  /**
   * Ensures user exists in LiteLLM backend, creating them if necessary
   */
  private async ensureLiteLLMUser(user: {
    id: string;
    username: string;
    email: string;
    fullName?: string;
    roles: string[];
  }): Promise<void> {
    try {
      // Check if user exists in LiteLLM (using fixed team-based detection)
      const existingUser = await this.liteLLMService.getUserInfo(user.id);
      if (existingUser) {
        this.fastify.log.info({ userId: user.id }, 'User already exists in LiteLLM');
        return;
      }

      // User doesn't exist in LiteLLM, create them with default team assignment
      this.fastify.log.info(
        { userId: user.id, email: user.email },
        'Creating user in LiteLLM with default team',
      );

      // Ensure default team exists in both database and LiteLLM first
      await this.defaultTeamService.ensureDefaultTeamExists();

      // Ensure user is assigned to default team in database
      await this.ensureUserTeamMembership(user.id, DefaultTeamService.DEFAULT_TEAM_ID);

      await this.liteLLMService.createUser({
        user_id: user.id,
        user_email: user.email,
        user_alias: user.username,
        user_role: user.roles.includes('admin') ? 'proxy_admin' : 'internal_user',
        max_budget: Number(this.fastify.config.DEFAULT_USER_MAX_BUDGET), // Configurable via DEFAULT_USER_MAX_BUDGET env var
        tpm_limit: Number(this.fastify.config.DEFAULT_USER_TPM_LIMIT), // Configurable via DEFAULT_USER_TPM_LIMIT env var
        rpm_limit: Number(this.fastify.config.DEFAULT_USER_RPM_LIMIT), // Configurable via DEFAULT_USER_RPM_LIMIT env var
        auto_create_key: false, // Don't auto-create key during user creation
        teams: [DefaultTeamService.DEFAULT_TEAM_ID], // CRITICAL: Always assign user to default team
      });

      this.fastify.log.info(
        { userId: user.id },
        'Successfully created user in LiteLLM with default team',
      );
    } catch (createError: any) {
      // Check if error is due to user already existing (by email)
      if (createError.message && createError.message.includes('already exists')) {
        this.fastify.log.info(
          { userId: user.id, email: user.email },
          'User already exists in LiteLLM (by email) - continuing',
        );
        // Don't throw - user exists, which is what we wanted
        return;
      }

      this.fastify.log.warn(
        {
          userId: user.id,
          error: createError instanceof Error ? createError.message : 'Unknown error',
        },
        'Failed to create user in LiteLLM - will retry during sync',
      );

      // Don't throw here - let the user continue and sync will retry later
      // The sync process will handle retries
    }
  }

  async processOAuthUser(userInfo: OAuthUserInfo): Promise<{
    id: string;
    username: string;
    email: string;
    fullName?: string;
    roles: string[];
  }> {
    const openShiftRoles = this.mapGroupsToRoles(userInfo.groups || []);

    // Check if user exists in database
    const existingUser = await this.fastify.dbUtils.queryOne(
      'SELECT * FROM users WHERE oauth_id = $1 AND oauth_provider = $2',
      [userInfo.sub, 'openshift'],
    );

    let user: {
      id: string;
      username: string;
      email: string;
      fullName?: string;
      roles: string[];
    };

    if (existingUser) {
      // Merge existing roles with OpenShift group roles
      const existingRoles = Array.isArray(existingUser.roles) ? existingUser.roles : [];
      const mergedRoles = this.mergeRoles(existingRoles, openShiftRoles);

      // Update existing user - pass merged roles array directly for PostgreSQL array column
      await this.fastify.dbUtils.query(
        `UPDATE users SET 
         username = $1, email = $2, full_name = $3, roles = $4, last_login_at = NOW(), updated_at = NOW()
         WHERE id = $5`,
        [
          userInfo.preferred_username,
          userInfo.email || null,
          userInfo.name || null,
          mergedRoles,
          existingUser.id as string,
        ],
      );

      user = {
        id: String(existingUser.id),
        username: userInfo.preferred_username,
        email: userInfo.email || userInfo.preferred_username,
        fullName: userInfo.name,
        roles: mergedRoles,
      };
    } else {
      // Create new user - for new users, OpenShift roles become their initial roles
      const newUser = await this.fastify.dbUtils.queryOne<DatabaseUser>(
        `INSERT INTO users (username, email, full_name, oauth_provider, oauth_id, roles, last_login_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, username, email, full_name`,
        [
          userInfo.preferred_username,
          userInfo.email || userInfo.preferred_username,
          userInfo.name || null,
          'openshift',
          userInfo.sub,
          openShiftRoles, // Pass array directly, PostgreSQL will handle the formatting
        ],
      );

      if (!newUser) {
        throw new Error('Failed to create user');
      }

      user = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.full_name,
        roles: openShiftRoles,
      };
    }

    // NEW: Ensure user exists in LiteLLM
    try {
      await this.ensureLiteLLMUser(user);

      // Update sync status to 'synced' if successful
      await this.fastify.dbUtils.query(
        'UPDATE users SET sync_status = $1, updated_at = NOW() WHERE id = $2',
        ['synced', user.id],
      );

      this.fastify.log.info(
        { userId: user.id },
        'User successfully synced to LiteLLM during authentication',
      );
    } catch (error) {
      // Update sync status to 'error' but don't fail authentication
      await this.fastify.dbUtils.query(
        'UPDATE users SET sync_status = $1, updated_at = NOW() WHERE id = $2',
        ['error', user.id],
      );

      this.fastify.log.warn(
        {
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to sync user to LiteLLM during authentication - user can still proceed',
      );

      // Continue without throwing - user authentication should not fail due to LiteLLM issues
    }

    return user;
  }
}
