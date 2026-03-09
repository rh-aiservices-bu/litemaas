import { FastifyInstance } from 'fastify';
import * as https from 'https';
import { OAuthUserInfo, OAuthTokenResponse } from '../types';
import { LiteLLMService } from './litellm.service';
import { DefaultTeamService } from './default-team.service';
import { SettingsService } from './settings.service';
import { BaseService } from './base.service';

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

interface OIDCDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  issuer: string;
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

export class OAuthService extends BaseService {
  private isMockEnabled: boolean;
  private liteLLMService: LiteLLMService;
  private defaultTeamService: DefaultTeamService;
  private authProvider: string;
  private oidcDiscovery: OIDCDiscovery | null = null;
  private oidcDiscoveryPromise: Promise<OIDCDiscovery> | null = null;

  constructor(fastify: FastifyInstance, liteLLMService?: LiteLLMService) {
    super(fastify);
    this.isMockEnabled =
      process.env.OAUTH_MOCK_ENABLED === 'true' || process.env.NODE_ENV === 'development';
    this.liteLLMService = liteLLMService || new LiteLLMService(fastify);
    this.defaultTeamService = new DefaultTeamService(fastify, this.liteLLMService);
    this.authProvider = this.fastify.config.AUTH_PROVIDER || 'openshift';
  }

  getAuthProvider(): string {
    return this.authProvider;
  }

  private async fetchOIDCDiscovery(): Promise<OIDCDiscovery> {
    if (this.oidcDiscovery) {
      return this.oidcDiscovery;
    }

    if (this.oidcDiscoveryPromise) {
      return this.oidcDiscoveryPromise;
    }

    this.oidcDiscoveryPromise = (async () => {
      const issuer = this.fastify.config.OAUTH_ISSUER.replace(/\/$/, '');
      const discoveryUrl = `${issuer}/.well-known/openid-configuration`;

      this.fastify.log.info({ discoveryUrl }, 'Fetching OIDC discovery document');

      const response = await fetch(discoveryUrl, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.fastify.log.error(
          { status: response.status, errorText, discoveryUrl },
          'Failed to fetch OIDC discovery document',
        );
        throw this.createValidationError(
          'Failed to fetch OIDC discovery document',
          'issuer',
          undefined,
          'Unable to reach the OIDC provider. Check OAUTH_ISSUER configuration',
        );
      }

      const discovery = (await response.json()) as OIDCDiscovery;

      this.fastify.log.info(
        {
          authorization_endpoint: discovery.authorization_endpoint,
          token_endpoint: discovery.token_endpoint,
          userinfo_endpoint: discovery.userinfo_endpoint,
        },
        'OIDC discovery complete',
      );

      this.oidcDiscovery = discovery;
      return discovery;
    })();

    return this.oidcDiscoveryPromise;
  }

  private getCallbackUrl(request?: any): string {
    if (request) {
      const origin =
        request.headers.origin ||
        (request.headers.host ? `${request.protocol}://${request.headers.host}` : null);

      if (origin) {
        const callbackUrl = `${origin}/api/auth/callback`;
        this.fastify.log.debug({ origin, callbackUrl }, 'Using dynamic OAuth callback URL');
        return callbackUrl;
      }
    }

    return this.fastify.config.OAUTH_CALLBACK_URL;
  }

  private getScopes(): string {
    if (this.authProvider === 'oidc') {
      const customScopes = this.fastify.config.OIDC_SCOPES;
      return customScopes || 'openid profile email';
    }
    return 'user:info user:check-access';
  }

  async generateAuthUrl(state: string, request?: any): Promise<string> {
    if (this.isMockEnabled) {
      return `/api/auth/mock-login?state=${state}`;
    }

    const callbackUrl = this.getCallbackUrl(request);
    const scope = this.getScopes();

    if (this.authProvider === 'oidc') {
      const discovery = await this.fetchOIDCDiscovery();
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.fastify.config.OAUTH_CLIENT_ID,
        redirect_uri: callbackUrl,
        scope,
        state,
      });
      return `${discovery.authorization_endpoint}?${params.toString()}`;
    }

    // OpenShift OAuth
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.fastify.config.OAUTH_CLIENT_ID,
      redirect_uri: callbackUrl,
      scope,
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

    const storedCallbackUrl = (this.fastify as any).oauthHelpers.getStoredCallbackUrl(state);
    const callbackUrl = storedCallbackUrl || this.getCallbackUrl(request);

    let tokenUrl: string;

    if (this.authProvider === 'oidc') {
      const discovery = await this.fetchOIDCDiscovery();
      tokenUrl = discovery.token_endpoint;
    } else {
      tokenUrl = `${this.fastify.config.OAUTH_ISSUER}/oauth/token`;
    }

    this.fastify.log.debug(
      {
        tokenUrl,
        codePreview: code.substring(0, 20) + '...',
        clientId: this.fastify.config.OAUTH_CLIENT_ID,
        callbackUrl,
        authProvider: this.authProvider,
      },
      'Exchanging code for token',
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
      throw this.createValidationError(
        'Failed to exchange authorization code',
        'code',
        undefined,
        'The authorization code may be expired or invalid. Please try logging in again',
      );
    }

    const tokenResponse = await response.json();

    this.fastify.log.debug(
      {
        hasAccessToken: !!tokenResponse.access_token,
        tokenType: tokenResponse.token_type,
        expiresIn: tokenResponse.expires_in,
      },
      'Token received from auth provider',
    );

    return tokenResponse;
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    if (this.isMockEnabled) {
      return this.mockGetUserInfo(accessToken);
    }

    if (this.authProvider === 'oidc') {
      return this.getOIDCUserInfo(accessToken);
    }

    return this.getOpenShiftUserInfo(accessToken);
  }

  private async getOIDCUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const discovery = await this.fetchOIDCDiscovery();
    const userInfoUrl = discovery.userinfo_endpoint;

    this.fastify.log.debug(
      {
        userInfoUrl,
        accessTokenPreview: accessToken.substring(0, 20) + '...',
      },
      'Fetching user info from OIDC provider',
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
        'Failed to get user info from OIDC provider',
      );
      throw this.createUnauthorizedError(
        'Failed to get user information',
        'Unable to retrieve user details from OIDC provider. Please try logging in again',
      );
    }

    const userResponse = await response.json();

    this.fastify.log.debug({ userResponse }, 'OIDC user info received');

    const groupsClaim = this.fastify.config.OIDC_GROUPS_CLAIM || 'groups';
    const groups: string[] = userResponse[groupsClaim] || [];

    return {
      sub: userResponse.sub,
      preferred_username:
        userResponse.preferred_username || userResponse.email || userResponse.sub,
      name: userResponse.name,
      email: userResponse.email || userResponse.preferred_username,
      email_verified: userResponse.email_verified,
      groups,
    };
  }

  private async getOpenShiftUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // Convert OAuth issuer URL to API server URL if OPENSHIFT_API_URL is not set
    // From: https://oauth-openshift.apps.dev.rhoai.rh-aiservices-bu.com
    // To:   https://api.dev.rhoai.rh-aiservices-bu.com:6443
    const oauthIssuer = this.fastify.config.OAUTH_ISSUER;
    let apiServerUrl: string;

    if (this.fastify.config.OPENSHIFT_API_URL) {
      apiServerUrl = this.fastify.config.OPENSHIFT_API_URL;
    } else if (oauthIssuer.includes('oauth-openshift.apps.')) {
      apiServerUrl =
        oauthIssuer.replace('oauth-openshift.apps.', 'api.').replace(/\/$/, '') + ':6443';
    } else {
      apiServerUrl = oauthIssuer;
    }

    const userInfoUrl = `${apiServerUrl}/apis/user.openshift.io/v1/users/~`;

    const skipTlsVerify = this.fastify.config.K8S_API_SKIP_TLS_VERIFY === 'true';

    if (skipTlsVerify) {
      this.fastify.log.warn(
        { apiServerUrl },
        'K8S_API_SKIP_TLS_VERIFY is enabled - skipping TLS verification for Kubernetes API calls. This should only be used in development or with trusted clusters.',
      );
    }

    this.fastify.log.debug(
      {
        oauthIssuer,
        apiServerUrl,
        userInfoUrl,
        accessTokenPreview: accessToken.substring(0, 20) + '...',
        skipTlsVerify,
      },
      'Fetching user info from OpenShift API server',
    );

    const httpsAgent = skipTlsVerify ? new https.Agent({ rejectUnauthorized: false }) : undefined;

    const response = await fetch(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      // @ts-expect-error - Node.js fetch supports agent option
      agent: httpsAgent,
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
      throw this.createUnauthorizedError(
        'Failed to get user information',
        'Unable to retrieve user details from authentication provider. Please try logging in again',
      );
    }

    const userResponse = await response.json();

    this.fastify.log.debug({ userResponse }, 'OpenShift user info received');

    return {
      sub: userResponse.metadata.uid,
      preferred_username: userResponse.metadata.name,
      name: userResponse.fullName,
      email: userResponse.metadata.name,
      email_verified: true,
      groups: userResponse.groups || [],
    };
  }

  private mockTokenExchange(code: string): OAuthTokenResponse {
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
   * Returns admin roles if the username matches the INITIAL_ADMIN_USERS env var.
   */
  private getInitialAdminRoles(username: string): string[] {
    const initialAdminUsers = this.fastify.config.INITIAL_ADMIN_USERS;
    if (!initialAdminUsers) {
      return [];
    }

    const adminUsernames = initialAdminUsers
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (adminUsernames.includes(username)) {
      this.fastify.log.info({ username }, 'User matched INITIAL_ADMIN_USERS — granting admin role');
      return ['admin', 'user'];
    }

    return [];
  }

  /**
   * Merges existing user roles with group-derived roles.
   * Application-set roles take precedence - if a user has been explicitly granted
   * a role through the application, it's preserved even if not in provider groups.
   * Provider groups provide additional roles on top of existing ones.
   */
  private mergeRoles(existingRoles: string[], providerRoles: string[]): string[] {
    const allRoles = new Set<string>();

    allRoles.add('user');

    existingRoles.forEach((role) => allRoles.add(role));
    providerRoles.forEach((role) => allRoles.add(role));

    return Array.from(allRoles);
  }

  /**
   * Ensures user is a member of the default team in the database
   */
  private async ensureUserTeamMembership(userId: string, teamId: string): Promise<void> {
    if (teamId === DefaultTeamService.DEFAULT_TEAM_ID) {
      await this.defaultTeamService.assignUserToDefaultTeam(userId);
    } else {
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
  private async ensureLiteLLMUser(
    user: {
      id: string;
      username: string;
      email: string;
      fullName?: string;
      roles: string[];
    },
    preFetchedDefaults?: { maxBudget: number; tpmLimit: number; rpmLimit: number },
  ): Promise<void> {
    try {
      const existingUser = await this.liteLLMService.getUserInfo(user.id);
      if (existingUser) {
        this.fastify.log.info({ userId: user.id }, 'User already exists in LiteLLM');
        return;
      }

      this.fastify.log.info(
        { userId: user.id, email: user.email },
        'Creating user in LiteLLM with default team',
      );

      await this.defaultTeamService.ensureDefaultTeamExists();
      await this.ensureUserTeamMembership(user.id, DefaultTeamService.DEFAULT_TEAM_ID);

      let userDefaults: { maxBudget: number; tpmLimit: number; rpmLimit: number };
      if (preFetchedDefaults) {
        userDefaults = preFetchedDefaults;
      } else {
        const settingsService = new SettingsService(this.fastify);
        userDefaults = await settingsService.getEffectiveUserDefaults();
      }

      await this.liteLLMService.createUser({
        user_id: user.id,
        user_email: user.email,
        user_alias: user.username,
        user_role: user.roles.includes('admin') ? 'proxy_admin' : 'internal_user',
        max_budget: userDefaults.maxBudget,
        tpm_limit: userDefaults.tpmLimit,
        rpm_limit: userDefaults.rpmLimit,
        auto_create_key: false,
        teams: [DefaultTeamService.DEFAULT_TEAM_ID],
      });

      this.fastify.log.info(
        { userId: user.id },
        'Successfully created user in LiteLLM with default team',
      );
    } catch (createError: any) {
      if (createError.message && createError.message.includes('already exists')) {
        this.fastify.log.info(
          { userId: user.id, email: user.email },
          'User already exists in LiteLLM (by email) - continuing',
        );
        return;
      }

      this.fastify.log.warn(
        {
          userId: user.id,
          error: createError instanceof Error ? createError.message : 'Unknown error',
        },
        'Failed to create user in LiteLLM - will retry during sync',
      );
    }
  }

  async processOAuthUser(userInfo: OAuthUserInfo): Promise<{
    id: string;
    username: string;
    email: string;
    fullName?: string;
    roles: string[];
  }> {
    const groupRoles = this.mapGroupsToRoles(userInfo.groups || []);
    const initialAdminRoles = this.getInitialAdminRoles(userInfo.preferred_username);
    const derivedRoles = this.mergeRoles(groupRoles, initialAdminRoles);

    const oauthProvider = this.authProvider;

    // Check if user exists in database
    const existingUser = await this.fastify.dbUtils.queryOne(
      'SELECT * FROM users WHERE oauth_id = $1 AND oauth_provider = $2',
      [userInfo.sub, oauthProvider],
    );

    let user: {
      id: string;
      username: string;
      email: string;
      fullName?: string;
      roles: string[];
    };
    let userDefaults: { maxBudget: number; tpmLimit: number; rpmLimit: number } | undefined;

    if (existingUser) {
      const existingRoles = Array.isArray(existingUser.roles) ? existingUser.roles : [];
      const mergedRoles = this.mergeRoles(existingRoles, derivedRoles);

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
      const settingsService = new SettingsService(this.fastify);
      userDefaults = await settingsService.getEffectiveUserDefaults();

      const newUser = await this.fastify.dbUtils.queryOne<DatabaseUser>(
        `INSERT INTO users (username, email, full_name, oauth_provider, oauth_id, roles, max_budget, tpm_limit, rpm_limit, last_login_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING id, username, email, full_name`,
        [
          userInfo.preferred_username,
          userInfo.email || userInfo.preferred_username,
          userInfo.name || null,
          oauthProvider,
          userInfo.sub,
          derivedRoles,
          userDefaults.maxBudget,
          userDefaults.tpmLimit,
          userDefaults.rpmLimit,
        ],
      );

      if (!newUser) {
        throw this.createNotFoundError(
          'User',
          userInfo.sub,
          'Failed to create user account. Please contact support if this issue persists',
        );
      }

      user = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.full_name,
        roles: derivedRoles,
      };
    }

    // Ensure user exists in LiteLLM
    try {
      await this.ensureLiteLLMUser(user, userDefaults);

      await this.fastify.dbUtils.query(
        'UPDATE users SET sync_status = $1, updated_at = NOW() WHERE id = $2',
        ['synced', user.id],
      );

      this.fastify.log.info(
        { userId: user.id },
        'User successfully synced to LiteLLM during authentication',
      );
    } catch (error) {
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
    }

    return user;
  }
}
