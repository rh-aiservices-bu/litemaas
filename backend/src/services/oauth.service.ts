import { FastifyInstance } from 'fastify';
import * as https from 'https';
import { randomBytes, createHash } from 'crypto';
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
  end_session_endpoint?: string;
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
  private oidcDiscoveryCachedAt: number | null = null;

  constructor(fastify: FastifyInstance, liteLLMService?: LiteLLMService) {
    super(fastify);
    this.isMockEnabled =
      process.env.OAUTH_MOCK_ENABLED === 'true' || process.env.NODE_ENV === 'development';
    this.liteLLMService = liteLLMService || new LiteLLMService(fastify);
    this.defaultTeamService = new DefaultTeamService(fastify, this.liteLLMService);
    this.authProvider = this.fastify.config.AUTH_PROVIDER;
  }

  getAuthProvider(): string {
    return this.authProvider;
  }

  private isValidEmail(value: string | undefined): boolean {
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private async assertFetchOk(response: Response, context: string): Promise<void> {
    if (!response.ok) {
      const errorText = await response.text();
      this.fastify.log.error(
        { status: response.status, statusText: response.statusText, errorText },
        `Failed to ${context}`,
      );
      throw this.createValidationError(
        `Failed to ${context}`,
        'oauth',
        undefined,
        `The OIDC provider returned an error during ${context}`,
      );
    }
  }

  async getOIDCDiscoveryDocument(): Promise<OIDCDiscovery> {
    return this.fetchOIDCDiscovery();
  }

  private async fetchOIDCDiscovery(): Promise<OIDCDiscovery> {
    // Check if cache exists and is still valid (24 hour TTL)
    if (this.oidcDiscovery && this.oidcDiscoveryCachedAt) {
      const cacheAge = Date.now() - this.oidcDiscoveryCachedAt;
      const cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
      if (cacheAge <= cacheTTL) {
        return this.oidcDiscovery;
      }
    }

    // Save stale cache for failover before clearing
    const staleCache = this.oidcDiscovery;
    this.oidcDiscovery = null;
    this.oidcDiscoveryCachedAt = null;

    if (this.oidcDiscoveryPromise) {
      return this.oidcDiscoveryPromise;
    }

    this.oidcDiscoveryPromise = (async () => {
      const issuer = this.fastify.config.OAUTH_ISSUER.replace(/\/$/, '');
      const discoveryUrl = `${issuer}/.well-known/openid-configuration`;

      this.fastify.log.info({ discoveryUrl }, 'Fetching OIDC discovery document');

      try {
        const response = await fetch(discoveryUrl, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        });

        await this.assertFetchOk(response, 'fetch OIDC discovery document');

        let discovery: OIDCDiscovery;
        try {
          discovery = (await response.json()) as OIDCDiscovery;
        } catch (parseError) {
          this.fastify.log.error(
            { parseError, discoveryUrl },
            'Failed to parse OIDC discovery document as JSON',
          );
          throw this.createValidationError(
            'Invalid OIDC discovery document',
            'issuer',
            undefined,
            'The OIDC provider returned an invalid discovery document',
          );
        }

        // Validate issuer matches
        if (discovery.issuer !== issuer) {
          this.fastify.log.error(
            { expectedIssuer: issuer, actualIssuer: discovery.issuer },
            'OIDC discovery issuer mismatch',
          );
          throw this.createValidationError(
            'OIDC discovery issuer mismatch',
            'issuer',
            undefined,
            `Expected issuer ${issuer} but got ${discovery.issuer}`,
          );
        }

        // Validate HTTPS in production
        if (process.env.NODE_ENV === 'production') {
          const endpoints = [
            { name: 'authorization_endpoint', url: discovery.authorization_endpoint },
            { name: 'token_endpoint', url: discovery.token_endpoint },
            { name: 'userinfo_endpoint', url: discovery.userinfo_endpoint },
          ];

          for (const endpoint of endpoints) {
            if (!endpoint.url.startsWith('https://')) {
              this.fastify.log.error(
                { endpoint: endpoint.name, url: endpoint.url },
                'OIDC endpoint does not use HTTPS in production',
              );
              throw this.createValidationError(
                'Insecure OIDC endpoint',
                'issuer',
                undefined,
                `${endpoint.name} must use HTTPS in production`,
              );
            }
          }
        }

        // Warn if endpoints are on different origins than issuer
        const issuerOrigin = new URL(issuer).origin;
        const endpoints = [
          { name: 'authorization_endpoint', url: discovery.authorization_endpoint },
          { name: 'token_endpoint', url: discovery.token_endpoint },
          { name: 'userinfo_endpoint', url: discovery.userinfo_endpoint },
        ];

        for (const endpoint of endpoints) {
          try {
            const endpointOrigin = new URL(endpoint.url).origin;
            if (endpointOrigin !== issuerOrigin) {
              this.fastify.log.warn(
                { endpoint: endpoint.name, issuerOrigin, endpointOrigin },
                'OIDC endpoint origin differs from issuer origin',
              );
            }
          } catch (urlError) {
            this.fastify.log.warn(
              { endpoint: endpoint.name, url: endpoint.url },
              'Failed to parse endpoint URL',
            );
          }
        }

        this.fastify.log.info(
          {
            authorization_endpoint: discovery.authorization_endpoint,
            token_endpoint: discovery.token_endpoint,
            userinfo_endpoint: discovery.userinfo_endpoint,
            end_session_endpoint: discovery.end_session_endpoint,
          },
          'OIDC discovery complete',
        );

        this.oidcDiscovery = discovery;
        this.oidcDiscoveryCachedAt = Date.now();
        return discovery;
      } catch (error) {
        // Clear the promise on failure so next call will retry
        this.oidcDiscoveryPromise = null;

        // Fall back to stale cache if available
        if (staleCache) {
          this.fastify.log.warn(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            'Using stale OIDC discovery cache due to fetch failure',
          );
          this.oidcDiscovery = staleCache;
          // Don't update cachedAt — keep it expired so next call retries
          return staleCache;
        }

        throw error;
      }
    })();

    return this.oidcDiscoveryPromise;
  }

  private getCallbackUrl(): string {
    return this.fastify.config.OAUTH_CALLBACK_URL;
  }

  private getScopes(): string {
    if (this.authProvider === 'oidc') {
      const customScopes = this.fastify.config.OIDC_SCOPES;
      return customScopes || 'openid profile email';
    }
    return 'user:info user:check-access';
  }

  async generateAuthUrl(
    state: string,
  ): Promise<{ url: string; codeVerifier?: string; nonce?: string }> {
    if (this.isMockEnabled) {
      return { url: `/api/auth/mock-login?state=${state}` };
    }

    const callbackUrl = this.getCallbackUrl();
    const scope = this.getScopes();

    if (this.authProvider === 'oidc') {
      const discovery = await this.fetchOIDCDiscovery();
      const pkce = this.generatePKCE();
      const nonce = randomBytes(16).toString('hex');

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.fastify.config.OAUTH_CLIENT_ID,
        redirect_uri: callbackUrl,
        scope,
        state,
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256',
        nonce,
      });

      return {
        url: `${discovery.authorization_endpoint}?${params.toString()}`,
        codeVerifier: pkce.verifier,
        nonce,
      };
    }

    // OpenShift OAuth (no PKCE)
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.fastify.config.OAUTH_CLIENT_ID,
      redirect_uri: callbackUrl,
      scope,
      state,
    });

    return { url: `${this.fastify.config.OAUTH_ISSUER}/oauth/authorize?${params.toString()}` };
  }

  async exchangeCodeForToken(
    code: string,
    state: string,
    codeVerifier?: string,
  ): Promise<OAuthTokenResponse> {
    if (this.isMockEnabled) {
      return this.mockTokenExchange(code);
    }

    const storedCallbackUrl = (this.fastify as any).oauthHelpers.getStoredCallbackUrl(state);
    const callbackUrl = storedCallbackUrl || this.getCallbackUrl();

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
        hasPKCE: !!codeVerifier,
      },
      'Exchanging code for token',
    );

    const bodyParams: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      client_id: this.fastify.config.OAUTH_CLIENT_ID,
      client_secret: this.fastify.config.OAUTH_CLIENT_SECRET,
      redirect_uri: callbackUrl,
    };

    // Add PKCE code_verifier for OIDC
    if (this.authProvider === 'oidc' && codeVerifier) {
      bodyParams.code_verifier = codeVerifier;
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(bodyParams),
      signal: AbortSignal.timeout(10000),
    });

    await this.assertFetchOk(response, 'exchange authorization code for token');

    let tokenResponse: OAuthTokenResponse;
    try {
      tokenResponse = await response.json();
    } catch (parseError) {
      this.fastify.log.error({ parseError, tokenUrl }, 'Failed to parse token response as JSON');
      throw this.createValidationError(
        'Invalid token response',
        'code',
        undefined,
        'The authorization provider returned an invalid token response',
      );
    }

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

  /**
   * Validates the ID token's nonce and audience claims.
   * Only applicable when an ID token is present (OIDC flow).
   */
  validateIdToken(tokenResponse: OAuthTokenResponse, expectedNonce?: string): void {
    const idToken = (tokenResponse as any).id_token;
    if (!idToken || typeof idToken !== 'string') {
      return; // No ID token to validate (e.g., OpenShift flow)
    }

    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        this.fastify.log.warn('ID token does not have 3 parts, skipping validation');
        return;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      // Validate nonce (M1)
      if (expectedNonce && payload.nonce !== expectedNonce) {
        this.fastify.log.error(
          { expectedNonce, actualNonce: payload.nonce },
          'ID token nonce mismatch',
        );
        throw this.createValidationError(
          'ID token nonce mismatch',
          'nonce',
          undefined,
          'The authentication response failed security validation. Please try logging in again',
        );
      }

      // Validate audience (M2)
      const expectedClientId = this.fastify.config.OAUTH_CLIENT_ID;
      const aud = payload.aud;
      const audValid = Array.isArray(aud)
        ? aud.includes(expectedClientId)
        : aud === expectedClientId;

      if (!audValid) {
        this.fastify.log.error(
          { expectedAud: expectedClientId, actualAud: aud },
          'Invalid audience in ID token',
        );
        throw this.createValidationError(
          'Invalid audience in ID token',
          'aud',
          undefined,
          'The authentication response was not intended for this application. Please try logging in again',
        );
      }

      this.fastify.log.debug('ID token nonce and audience validated successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('ID token')) {
        throw error; // Re-throw our own validation errors
      }
      this.fastify.log.warn(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to decode ID token for validation, skipping',
      );
    }
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
      signal: AbortSignal.timeout(10000),
    });

    await this.assertFetchOk(response, 'get user info from OIDC provider');

    let userResponse: any;
    try {
      userResponse = await response.json();
    } catch (parseError) {
      this.fastify.log.error(
        { parseError, userInfoUrl },
        'Failed to parse OIDC userinfo response as JSON',
      );
      throw this.createUnauthorizedError(
        'Invalid user information response',
        'The OIDC provider returned an invalid user information response',
      );
    }

    this.fastify.log.debug({ userResponse }, 'OIDC user info received');

    const groupsClaim = this.fastify.config.OIDC_GROUPS_CLAIM || 'groups';
    const claimValue = userResponse[groupsClaim];
    const groups: string[] = Array.isArray(claimValue) ? claimValue : [];

    if (claimValue && !Array.isArray(claimValue)) {
      this.fastify.log.warn(
        { groupsClaim, type: typeof claimValue },
        'Groups claim is not an array, ignoring',
      );
    }

    return {
      sub: userResponse.sub,
      preferred_username: userResponse.preferred_username || userResponse.email || userResponse.sub,
      name: userResponse.name,
      email:
        userResponse.email ||
        (this.isValidEmail(userResponse.preferred_username)
          ? userResponse.preferred_username
          : undefined),
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
      signal: AbortSignal.timeout(10000),
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

    let userResponse: any;
    try {
      userResponse = await response.json();
    } catch (parseError) {
      this.fastify.log.error(
        { parseError, userInfoUrl },
        'Failed to parse OpenShift userinfo response as JSON',
      );
      throw this.createUnauthorizedError(
        'Invalid user information response',
        'The authentication provider returned an invalid user information response',
      );
    }

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
    return randomBytes(32).toString('hex');
  }

  private generatePKCE(): { verifier: string; challenge: string } {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  async getLogoutUrl(): Promise<string | null> {
    if (this.authProvider !== 'oidc') {
      return null;
    }

    try {
      const discovery = await this.fetchOIDCDiscovery();
      if (!discovery.end_session_endpoint) {
        return null;
      }

      const params = new URLSearchParams({
        post_logout_redirect_uri: this.fastify.config.OAUTH_CALLBACK_URL.replace(
          '/api/auth/callback',
          '',
        ),
        client_id: this.fastify.config.OAUTH_CLIENT_ID,
      });

      return `${discovery.end_session_endpoint}?${params.toString()}`;
    } catch {
      return null;
    }
  }

  async getDiscoveryStatus(): Promise<'healthy' | 'not_applicable' | 'unknown'> {
    if (this.authProvider !== 'oidc') {
      return 'not_applicable';
    }

    if (this.oidcDiscovery && this.oidcDiscoveryCachedAt) {
      const cacheAge = Date.now() - this.oidcDiscoveryCachedAt;
      const cacheTTL = 24 * 60 * 60 * 1000;
      if (cacheAge <= cacheTTL) {
        return 'healthy';
      }
    }

    return 'unknown';
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

      // User not found by our ID. Check if they exist in LiteLLM under a different
      // user_id (e.g., pre-existing user from before migration). Look up by email
      // in LiteLLM_UserTable to find their actual LiteLLM user_id.
      try {
        const litellmUser = await this.fastify.dbUtils.queryOne<{ user_id: string }>(
          `SELECT user_id FROM "LiteLLM_UserTable" WHERE user_email = $1`,
          [user.email],
        );

        if (litellmUser && litellmUser.user_id !== user.id) {
          this.fastify.log.info(
            { litemaasId: user.id, litellmId: litellmUser.user_id, email: user.email },
            'User exists in LiteLLM with different ID - updating LiteMaaS to match',
          );

          // Update our users table to use the LiteLLM user_id so they stay in sync.
          // This handles the case where migration created users with gen_random_uuid()
          // but LiteLLM already had them with a different user_id.
          await this.fastify.dbUtils.query(`UPDATE users SET id = $1 WHERE id = $2`, [
            litellmUser.user_id,
            user.id,
          ]);

          // Update dependent tables
          const dependentUpdates = [
            'UPDATE api_keys SET user_id = $1 WHERE user_id = $2',
            'UPDATE subscriptions SET user_id = $1 WHERE user_id = $2',
            'UPDATE audit_logs SET user_id = $1 WHERE user_id = $2',
            'UPDATE team_members SET user_id = $1 WHERE user_id = $2',
            'UPDATE refresh_tokens SET user_id = $1 WHERE user_id = $2',
            'UPDATE oauth_sessions SET user_id = $1 WHERE user_id = $2',
          ];
          for (const sql of dependentUpdates) {
            await this.fastify.dbUtils.query(sql, [litellmUser.user_id, user.id]).catch(() => {});
          }

          this.fastify.log.info(
            { oldId: user.id, newId: litellmUser.user_id },
            'User ID realigned with LiteLLM',
          );
          return;
        }
      } catch (lookupError) {
        this.fastify.log.debug({ lookupError }, 'Could not look up user in LiteLLM_UserTable');
      }

      // User doesn't exist in LiteLLM at all, create them with default team assignment
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
    let existingUser = await this.fastify.dbUtils.queryOne(
      'SELECT * FROM users WHERE oauth_id = $1 AND oauth_provider = $2',
      [userInfo.sub, oauthProvider],
    );

    // Provider migration: look up by email if not found by oauth_id
    if (!existingUser && userInfo.email) {
      const emailUser = await this.fastify.dbUtils.queryOne(
        'SELECT * FROM users WHERE email = $1',
        [userInfo.email],
      );
      if (emailUser) {
        this.fastify.log.info(
          {
            userId: emailUser.id,
            email: userInfo.email,
            oldProvider: emailUser.oauth_provider,
            newProvider: oauthProvider,
          },
          'Migrating user to new auth provider (matched by email)',
        );
        await this.fastify.dbUtils.query(
          'UPDATE users SET oauth_id = $1, oauth_provider = $2, updated_at = NOW() WHERE id = $3',
          [userInfo.sub, oauthProvider, String(emailUser.id)],
        );
        existingUser = emailUser;
      }
    }

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
