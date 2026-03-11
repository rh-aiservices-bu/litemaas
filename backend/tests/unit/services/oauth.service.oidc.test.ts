import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuthService } from '../../../src/services/oauth.service.js';
import { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';

// Mock Fastify instance with OIDC configuration
const createMockFastifyOIDC = (configOverrides: Record<string, unknown> = {}) =>
  ({
    dbUtils: {
      queryOne: vi.fn(),
      query: vi.fn(),
    },
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    config: {
      AUTH_PROVIDER: 'oidc',
      OAUTH_ISSUER: 'https://keycloak.example.com/realms/test',
      OAUTH_CLIENT_ID: 'litemaas-client',
      OAUTH_CLIENT_SECRET: 'secret123',
      OAUTH_CALLBACK_URL: 'https://litemaas.example.com/api/auth/callback',
      OIDC_GROUPS_CLAIM: 'groups',
      OIDC_SCOPES: 'openid profile email',
      DEFAULT_USER_MAX_BUDGET: '10',
      DEFAULT_USER_TPM_LIMIT: '10000',
      DEFAULT_USER_RPM_LIMIT: '60',
      ...configOverrides,
    },
    oauthHelpers: {
      generateAndStoreState: vi.fn(),
      validateState: vi.fn(),
      getStoredCallbackUrl: vi.fn(),
      getStoredCodeVerifier: vi.fn(),
      clearState: vi.fn(),
    },
  }) as unknown as FastifyInstance;

// Mock OpenShift Fastify instance
const createMockFastifyOpenShift = (configOverrides: Record<string, unknown> = {}) =>
  ({
    dbUtils: {
      queryOne: vi.fn(),
      query: vi.fn(),
    },
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    config: {
      AUTH_PROVIDER: 'openshift',
      OAUTH_ISSUER: 'https://oauth-openshift.apps.example.com',
      OAUTH_CLIENT_ID: 'litemaas-client',
      OAUTH_CLIENT_SECRET: 'secret123',
      OAUTH_CALLBACK_URL: 'https://litemaas.example.com/api/auth/callback',
      DEFAULT_USER_MAX_BUDGET: '10',
      DEFAULT_USER_TPM_LIMIT: '10000',
      DEFAULT_USER_RPM_LIMIT: '60',
      ...configOverrides,
    },
    oauthHelpers: {
      generateAndStoreState: vi.fn(),
      validateState: vi.fn(),
      getStoredCallbackUrl: vi.fn(),
      getStoredCodeVerifier: vi.fn(),
      clearState: vi.fn(),
    },
  }) as unknown as FastifyInstance;

// Mock OIDC discovery response
const createMockOIDCDiscovery = (overrides = {}) => ({
  issuer: 'https://keycloak.example.com/realms/test',
  authorization_endpoint: 'https://keycloak.example.com/realms/test/protocol/openid-connect/auth',
  token_endpoint: 'https://keycloak.example.com/realms/test/protocol/openid-connect/token',
  userinfo_endpoint: 'https://keycloak.example.com/realms/test/protocol/openid-connect/userinfo',
  end_session_endpoint:
    'https://keycloak.example.com/realms/test/protocol/openid-connect/logout',
  ...overrides,
});

// Mock OIDC userinfo response
const createMockOIDCUserInfo = (overrides = {}) => ({
  sub: 'oidc-user-123',
  preferred_username: 'testuser',
  email: 'test@example.com',
  name: 'Test User',
  email_verified: true,
  groups: ['users', 'developers'],
  ...overrides,
});

describe('OAuthService - OIDC Specific Tests', () => {
  let service: OAuthService;
  let mockFastify: FastifyInstance;
  let mockLiteLLMService: any;
  let mockDefaultTeamService: any;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFastify = createMockFastifyOIDC();
    mockLiteLLMService = {
      createUser: vi.fn(),
      getUserInfo: vi.fn(),
    };
    mockDefaultTeamService = {
      ensureUserMembership: vi.fn(),
    };

    service = new OAuthService(mockFastify, mockLiteLLMService, mockDefaultTeamService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('fetchOIDCDiscovery', () => {
    it('should fetch OIDC discovery document successfully', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      const discovery = await (service as any).fetchOIDCDiscovery();

      expect(discovery).toEqual(mockDiscovery);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://keycloak.example.com/realms/test/.well-known/openid-configuration',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        }),
      );
      expect(mockFastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ discoveryUrl: expect.any(String) }),
        'Fetching OIDC discovery document',
      );
    });

    it('should cache discovery document and return cached value within TTL', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      // First call - should fetch
      const discovery1 = await (service as any).fetchOIDCDiscovery();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const discovery2 = await (service as any).fetchOIDCDiscovery();
      expect(global.fetch).toHaveBeenCalledTimes(1); // Not called again
      expect(discovery1).toEqual(discovery2);
    });

    it('should expire cache after 24 hours and refetch', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      // First call
      await (service as any).fetchOIDCDiscovery();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Manually expire the cache (24 hours + 1ms) and clear the promise
      const cacheTTL = 24 * 60 * 60 * 1000;
      (service as any).oidcDiscoveryCachedAt = Date.now() - cacheTTL - 1;
      (service as any).oidcDiscoveryPromise = null; // Clear promise to allow refetch

      // Second call - should refetch due to expired cache
      await (service as any).fetchOIDCDiscovery();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should clear promise on failure to allow retry', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockOIDCDiscovery(),
        } as Response);

      // First call fails
      await expect((service as any).fetchOIDCDiscovery()).rejects.toThrow('Network error');
      expect((service as any).oidcDiscoveryPromise).toBeNull();

      // Second call should succeed (promise was cleared)
      const discovery = await (service as any).fetchOIDCDiscovery();
      expect(discovery).toBeDefined();
    });

    it('should validate issuer matches discovery document', async () => {
      const mockDiscovery = createMockOIDCDiscovery({
        issuer: 'https://different-issuer.example.com',
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      await expect((service as any).fetchOIDCDiscovery()).rejects.toThrow(/issuer mismatch/i);
      expect(mockFastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedIssuer: 'https://keycloak.example.com/realms/test',
          actualIssuer: 'https://different-issuer.example.com',
        }),
        'OIDC discovery issuer mismatch',
      );
    });

    it('should enforce HTTPS in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockDiscovery = createMockOIDCDiscovery({
        authorization_endpoint: 'http://insecure.example.com/auth', // HTTP instead of HTTPS
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      await expect((service as any).fetchOIDCDiscovery()).rejects.toThrow(/Insecure OIDC endpoint/);
      expect(mockFastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'authorization_endpoint',
        }),
        'OIDC endpoint does not use HTTPS in production',
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should allow HTTP endpoints in non-production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockDiscovery = createMockOIDCDiscovery({
        authorization_endpoint: 'http://localhost:8080/auth',
        token_endpoint: 'http://localhost:8080/token',
        userinfo_endpoint: 'http://localhost:8080/userinfo',
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      const discovery = await (service as any).fetchOIDCDiscovery();
      expect(discovery).toEqual(mockDiscovery);

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      } as Response);

      await expect((service as any).fetchOIDCDiscovery()).rejects.toThrow(
        /Failed to fetch OIDC discovery/i,
      );
      expect(mockFastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 404,
          errorText: 'Not Found',
        }),
        'Failed to fetch OIDC discovery document',
      );
    });

    it('should handle invalid JSON in discovery document', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response);

      await expect((service as any).fetchOIDCDiscovery()).rejects.toThrow(
        /Invalid OIDC discovery/i,
      );
      expect(mockFastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          parseError: expect.any(Error),
        }),
        'Failed to parse OIDC discovery document as JSON',
      );
    });

    it('should warn if endpoints are on different origin than issuer', async () => {
      const mockDiscovery = createMockOIDCDiscovery({
        authorization_endpoint: 'https://different-origin.example.com/auth',
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      await (service as any).fetchOIDCDiscovery();

      expect(mockFastify.log.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'authorization_endpoint',
        }),
        'OIDC endpoint origin differs from issuer origin',
      );
    });

    it('should handle multiple concurrent fetch requests with promise caching', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      let fetchCallCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        fetchCallCount++;
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          ok: true,
          json: async () => mockDiscovery,
        } as Response;
      });

      // Make multiple concurrent requests
      const [discovery1, discovery2, discovery3] = await Promise.all([
        (service as any).fetchOIDCDiscovery(),
        (service as any).fetchOIDCDiscovery(),
        (service as any).fetchOIDCDiscovery(),
      ]);

      // Should only fetch once due to promise caching
      expect(fetchCallCount).toBe(1);
      expect(discovery1).toEqual(discovery2);
      expect(discovery2).toEqual(discovery3);
    });

    it('should remove trailing slash from issuer before fetching', async () => {
      const mockFastifyWithTrailingSlash = createMockFastifyOIDC({
        OAUTH_ISSUER: 'https://keycloak.example.com/realms/test/', // Trailing slash
      });
      const serviceWithTrailingSlash = new OAuthService(
        mockFastifyWithTrailingSlash,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      await (serviceWithTrailingSlash as any).fetchOIDCDiscovery();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://keycloak.example.com/realms/test/.well-known/openid-configuration',
        expect.anything(),
      );
    });
  });

  describe('generateAuthUrl - OIDC mode', () => {
    it('should generate OIDC auth URL with PKCE parameters', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      const result = await service.generateAuthUrl('test-state-123');

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('codeVerifier');
      expect(result.codeVerifier).toBeDefined();

      const url = new URL(result.url);
      expect(url.origin + url.pathname).toBe(mockDiscovery.authorization_endpoint);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBe('litemaas-client');
      expect(url.searchParams.get('state')).toBe('test-state-123');
      expect(url.searchParams.get('code_challenge')).toBeDefined();
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('scope')).toBe('openid profile email');
    });

    it('should use custom OIDC scopes if configured', async () => {
      const customMockFastify = createMockFastifyOIDC({
        OIDC_SCOPES: 'openid profile email groups roles',
      });
      const customService = new OAuthService(
        customMockFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      const result = await customService.generateAuthUrl('test-state');

      const url = new URL(result.url);
      expect(url.searchParams.get('scope')).toBe('openid profile email groups roles');
    });

    it('should use default OIDC scopes when OIDC_SCOPES not configured', async () => {
      const customMockFastify = createMockFastifyOIDC({
        OIDC_SCOPES: undefined,
      });
      const customService = new OAuthService(
        customMockFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      const result = await customService.generateAuthUrl('test-state');

      const url = new URL(result.url);
      expect(url.searchParams.get('scope')).toBe('openid profile email');
    });

    it('should generate valid PKCE challenge from verifier', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      const result = await service.generateAuthUrl('test-state');

      expect(result.codeVerifier).toBeDefined();
      const url = new URL(result.url);
      const challenge = url.searchParams.get('code_challenge');
      expect(challenge).toBeDefined();

      // Verify the challenge is a valid SHA-256 hash of the verifier
      const expectedChallenge = createHash('sha256')
        .update(result.codeVerifier!)
        .digest('base64url');
      expect(challenge).toBe(expectedChallenge);
    });
  });

  describe('generateAuthUrl - OpenShift mode', () => {
    it('should NOT include PKCE parameters for OpenShift', async () => {
      const openshiftFastify = createMockFastifyOpenShift();
      const openshiftService = new OAuthService(
        openshiftFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      const result = await openshiftService.generateAuthUrl('test-state-123');

      expect(result).toHaveProperty('url');
      expect(result.codeVerifier).toBeUndefined();

      const url = new URL(result.url);
      expect(url.searchParams.get('code_challenge')).toBeNull();
      expect(url.searchParams.get('code_challenge_method')).toBeNull();
    });

    it('should use OpenShift-specific scopes', async () => {
      const openshiftFastify = createMockFastifyOpenShift();
      const openshiftService = new OAuthService(
        openshiftFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      const result = await openshiftService.generateAuthUrl('test-state');

      const url = new URL(result.url);
      expect(url.searchParams.get('scope')).toBe('user:info user:check-access');
    });
  });

  describe('exchangeCodeForToken - OIDC mode', () => {
    it('should include code_verifier for OIDC provider', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiscovery,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'oidc-access-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        } as Response);

      (mockFastify.oauthHelpers.getStoredCallbackUrl as any).mockReturnValue(undefined);

      await service.exchangeCodeForToken('auth-code-123', 'state-123', 'pkce-verifier-xyz');

      // Verify the token endpoint was called with code_verifier
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        mockDiscovery.token_endpoint,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: expect.any(URLSearchParams),
        }),
      );

      const callArgs = (global.fetch as any).mock.calls[1];
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('code_verifier')).toBe('pkce-verifier-xyz');
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('auth-code-123');
      expect(body.get('client_id')).toBe('litemaas-client');
      expect(body.get('client_secret')).toBe('secret123');
    });

    it('should use discovery token_endpoint for OIDC', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiscovery,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        } as Response);

      (mockFastify.oauthHelpers.getStoredCallbackUrl as any).mockReturnValue(undefined);

      await service.exchangeCodeForToken('code', 'state', 'verifier');

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        mockDiscovery.token_endpoint,
        expect.anything(),
      );
    });

    it('should handle token exchange errors gracefully', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiscovery,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: async () => 'invalid_grant',
        } as Response);

      (mockFastify.oauthHelpers.getStoredCallbackUrl as any).mockReturnValue(undefined);

      await expect(service.exchangeCodeForToken('code', 'state', 'verifier')).rejects.toThrow(
        /authorization code/i,
      );
      expect(mockFastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          errorText: 'invalid_grant',
        }),
        'Failed to exchange authorization code for token',
      );
    });
  });

  describe('exchangeCodeForToken - OpenShift mode', () => {
    it('should NOT include code_verifier for OpenShift', async () => {
      const openshiftFastify = createMockFastifyOpenShift();
      const openshiftService = new OAuthService(
        openshiftFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'openshift-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      } as Response);

      (openshiftFastify.oauthHelpers.getStoredCallbackUrl as any).mockReturnValue(undefined);

      await openshiftService.exchangeCodeForToken('auth-code-123', 'state-123', 'verifier-xyz');

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('code_verifier')).toBeNull();
    });
  });

  describe('getOIDCUserInfo', () => {
    it('should fetch user info from OIDC provider successfully', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      const mockUserInfo = createMockOIDCUserInfo();

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiscovery,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserInfo,
        } as Response);

      const userInfo = await (service as any).getOIDCUserInfo('access-token-123');

      expect(userInfo).toEqual({
        sub: 'oidc-user-123',
        preferred_username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        email_verified: true,
        groups: ['users', 'developers'],
      });

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        mockDiscovery.userinfo_endpoint,
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer access-token-123',
            Accept: 'application/json',
          },
        }),
      );
    });

    it('should use custom groups claim name when configured', async () => {
      const customMockFastify = createMockFastifyOIDC({
        OIDC_GROUPS_CLAIM: 'roles',
      });
      const customService = new OAuthService(
        customMockFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      const mockDiscovery = createMockOIDCDiscovery();
      const mockUserInfo = {
        sub: 'user-123',
        preferred_username: 'testuser',
        email: 'test@example.com',
        roles: ['admin', 'user'], // Custom claim name
        groups: ['this-should-be-ignored'],
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiscovery,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserInfo,
        } as Response);

      const userInfo = await (customService as any).getOIDCUserInfo('token');

      expect(userInfo.groups).toEqual(['admin', 'user']);
    });

    it('should handle missing groups claim gracefully', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      const mockUserInfo = createMockOIDCUserInfo();
      delete mockUserInfo.groups;

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiscovery,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserInfo,
        } as Response);

      const userInfo = await (service as any).getOIDCUserInfo('token');

      expect(userInfo.groups).toEqual([]);
    });

    it('should handle non-array groups claim with warning', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      const mockUserInfo = createMockOIDCUserInfo({
        groups: 'not-an-array', // Invalid type
      });

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiscovery,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserInfo,
        } as Response);

      const userInfo = await (service as any).getOIDCUserInfo('token');

      expect(userInfo.groups).toEqual([]);
      expect(mockFastify.log.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          groupsClaim: 'groups',
          type: 'string',
        }),
        'Groups claim is not an array, ignoring',
      );
    });

    it('should use email as fallback for preferred_username', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      const mockUserInfo = {
        sub: 'user-123',
        email: 'fallback@example.com',
        name: 'Test User',
        email_verified: true,
        groups: [],
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiscovery,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserInfo,
        } as Response);

      const userInfo = await (service as any).getOIDCUserInfo('token');

      expect(userInfo.preferred_username).toBe('fallback@example.com');
    });

    it('should use sub as fallback when both preferred_username and email are missing', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      const mockUserInfo = {
        sub: 'user-sub-123',
        name: 'Test User',
        groups: [],
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiscovery,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserInfo,
        } as Response);

      const userInfo = await (service as any).getOIDCUserInfo('token');

      expect(userInfo.preferred_username).toBe('user-sub-123');
      // email falls back to preferred_username, which falls back to sub
      expect(userInfo.email).toBeUndefined(); // email is undefined when not in response
    });

    it('should handle userinfo endpoint errors', async () => {
      const mockDiscovery = createMockOIDCDiscovery();

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiscovery,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => 'Invalid token',
        } as Response);

      await expect((service as any).getOIDCUserInfo('invalid-token')).rejects.toThrow(
        /Failed to get user info from OIDC provider/i,
      );
      expect(mockFastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 401,
          errorText: 'Invalid token',
        }),
        'Failed to get user info from OIDC provider',
      );
    });

    it('should handle invalid JSON in userinfo response', async () => {
      const mockDiscovery = createMockOIDCDiscovery();

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiscovery,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        } as Response);

      await expect((service as any).getOIDCUserInfo('token')).rejects.toThrow(
        /Invalid user information/i,
      );
      expect(mockFastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          parseError: expect.any(Error),
        }),
        'Failed to parse OIDC userinfo response as JSON',
      );
    });
  });

  describe('getCallbackUrl', () => {
    it('should always return configured callback URL', () => {
      const callbackUrl = (service as any).getCallbackUrl();
      expect(callbackUrl).toBe('https://litemaas.example.com/api/auth/callback');
    });

    it('should not dynamically construct callback URL', () => {
      // Verify it returns the same value regardless of context
      const url1 = (service as any).getCallbackUrl();
      const url2 = (service as any).getCallbackUrl();
      expect(url1).toBe(url2);
      expect(url1).toBe(mockFastify.config.OAUTH_CALLBACK_URL);
    });
  });

  describe('generateState', () => {
    it('should return hex string of correct length', () => {
      const state = service.generateState();
      expect(state).toMatch(/^[0-9a-f]+$/);
      expect(state.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique state values', () => {
      const states = new Set<string>();
      for (let i = 0; i < 100; i++) {
        states.add(service.generateState());
      }
      expect(states.size).toBe(100);
    });
  });

  describe('generatePKCE', () => {
    it('should return valid verifier and challenge', () => {
      const pkce = (service as any).generatePKCE();

      expect(pkce).toHaveProperty('verifier');
      expect(pkce).toHaveProperty('challenge');
      expect(typeof pkce.verifier).toBe('string');
      expect(typeof pkce.challenge).toBe('string');
      expect(pkce.verifier.length).toBeGreaterThan(0);
      expect(pkce.challenge.length).toBeGreaterThan(0);
    });

    it('should generate base64url encoded values', () => {
      const pkce = (service as any).generatePKCE();

      // base64url should only contain [A-Za-z0-9_-]
      expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate challenge as SHA-256 hash of verifier', () => {
      const pkce = (service as any).generatePKCE();

      const expectedChallenge = createHash('sha256').update(pkce.verifier).digest('base64url');
      expect(pkce.challenge).toBe(expectedChallenge);
    });

    it('should generate unique PKCE pairs', () => {
      const pkce1 = (service as any).generatePKCE();
      const pkce2 = (service as any).generatePKCE();

      expect(pkce1.verifier).not.toBe(pkce2.verifier);
      expect(pkce1.challenge).not.toBe(pkce2.challenge);
    });
  });

  describe('getLogoutUrl - OIDC provider', () => {
    it('should return logout URL when end_session_endpoint exists', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      const logoutUrl = await service.getLogoutUrl();

      expect(logoutUrl).toBeDefined();
      expect(logoutUrl).toContain(mockDiscovery.end_session_endpoint);
      expect(logoutUrl).toContain('post_logout_redirect_uri=');
      expect(logoutUrl).toContain('client_id=litemaas-client');
    });

    it('should return null when end_session_endpoint is missing', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      delete mockDiscovery.end_session_endpoint;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      const logoutUrl = await service.getLogoutUrl();

      expect(logoutUrl).toBeNull();
    });

    it('should handle discovery fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const logoutUrl = await service.getLogoutUrl();

      expect(logoutUrl).toBeNull();
    });

    it('should construct correct post_logout_redirect_uri', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      const logoutUrl = await service.getLogoutUrl();

      const url = new URL(logoutUrl!);
      const redirectUri = url.searchParams.get('post_logout_redirect_uri');
      expect(redirectUri).toBe('https://litemaas.example.com');
    });
  });

  describe('getLogoutUrl - OpenShift provider', () => {
    it('should return null for OpenShift provider', async () => {
      const openshiftFastify = createMockFastifyOpenShift();
      const openshiftService = new OAuthService(
        openshiftFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      const logoutUrl = await openshiftService.getLogoutUrl();

      expect(logoutUrl).toBeNull();
    });
  });

  describe('getDiscoveryStatus', () => {
    it('should return "healthy" when cache is valid', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      // Fetch discovery to populate cache
      await (service as any).fetchOIDCDiscovery();

      const status = await service.getDiscoveryStatus();
      expect(status).toBe('healthy');
    });

    it('should return "unknown" when cache is expired', async () => {
      const mockDiscovery = createMockOIDCDiscovery();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      } as Response);

      // Fetch discovery
      await (service as any).fetchOIDCDiscovery();

      // Expire the cache
      const cacheTTL = 24 * 60 * 60 * 1000;
      (service as any).oidcDiscoveryCachedAt = Date.now() - cacheTTL - 1;

      const status = await service.getDiscoveryStatus();
      expect(status).toBe('unknown');
    });

    it('should return "unknown" when discovery has not been fetched', async () => {
      const status = await service.getDiscoveryStatus();
      expect(status).toBe('unknown');
    });

    it('should return "not_applicable" for OpenShift provider', async () => {
      const openshiftFastify = createMockFastifyOpenShift();
      const openshiftService = new OAuthService(
        openshiftFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      const status = await openshiftService.getDiscoveryStatus();
      expect(status).toBe('not_applicable');
    });
  });

  describe('getAuthProvider', () => {
    it('should return "oidc" for OIDC configuration', () => {
      expect(service.getAuthProvider()).toBe('oidc');
    });

    it('should return "openshift" for OpenShift configuration', () => {
      const openshiftFastify = createMockFastifyOpenShift();
      const openshiftService = new OAuthService(
        openshiftFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      expect(openshiftService.getAuthProvider()).toBe('openshift');
    });
  });

  describe('validateIdToken', () => {
    it('should pass with valid nonce and audience', () => {
      const payload = { nonce: 'test-nonce', aud: 'litemaas-client', sub: 'user1' };
      const idToken = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
      const tokenResponse = { access_token: 'at', token_type: 'Bearer', id_token: idToken } as any;

      expect(() => service.validateIdToken(tokenResponse, 'test-nonce')).not.toThrow();
    });

    it('should throw on nonce mismatch', () => {
      const payload = { nonce: 'wrong-nonce', aud: 'litemaas-client', sub: 'user1' };
      const idToken = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
      const tokenResponse = { access_token: 'at', token_type: 'Bearer', id_token: idToken } as any;

      expect(() => service.validateIdToken(tokenResponse, 'expected-nonce')).toThrow(
        'ID token nonce mismatch',
      );
    });

    it('should pass when nonce is not expected (no nonce stored)', () => {
      const payload = { aud: 'litemaas-client', sub: 'user1' };
      const idToken = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
      const tokenResponse = { access_token: 'at', token_type: 'Bearer', id_token: idToken } as any;

      expect(() => service.validateIdToken(tokenResponse)).not.toThrow();
    });

    it('should validate audience as string', () => {
      const payload = { aud: 'litemaas-client', sub: 'user1' };
      const idToken = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
      const tokenResponse = { access_token: 'at', token_type: 'Bearer', id_token: idToken } as any;

      expect(() => service.validateIdToken(tokenResponse)).not.toThrow();
    });

    it('should validate audience as array', () => {
      const payload = { aud: ['litemaas-client', 'other-client'], sub: 'user1' };
      const idToken = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
      const tokenResponse = { access_token: 'at', token_type: 'Bearer', id_token: idToken } as any;

      expect(() => service.validateIdToken(tokenResponse)).not.toThrow();
    });

    it('should throw on invalid audience', () => {
      const payload = { aud: 'wrong-client', sub: 'user1' };
      const idToken = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
      const tokenResponse = { access_token: 'at', token_type: 'Bearer', id_token: idToken } as any;

      expect(() => service.validateIdToken(tokenResponse)).toThrow(
        'Invalid audience in ID token',
      );
    });

    it('should skip validation when no ID token is present', () => {
      const tokenResponse = { access_token: 'at', token_type: 'Bearer' } as any;

      expect(() => service.validateIdToken(tokenResponse, 'some-nonce')).not.toThrow();
    });
  });

  describe('email validation in OIDC userinfo', () => {
    it('should not use non-email preferred_username as email', async () => {
      const mockDiscovery = {
        authorization_endpoint: 'https://keycloak.example.com/realms/test/protocol/openid-connect/auth',
        token_endpoint: 'https://keycloak.example.com/realms/test/protocol/openid-connect/token',
        userinfo_endpoint: 'https://keycloak.example.com/realms/test/protocol/openid-connect/userinfo',
        issuer: 'https://keycloak.example.com/realms/test',
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Discovery call
          return Promise.resolve({
            ok: true,
            json: async () => mockDiscovery,
          });
        }
        // Userinfo call
        return Promise.resolve({
          ok: true,
          json: async () => ({
            sub: 'user-123',
            preferred_username: 'john_doe', // Not a valid email
            name: 'John Doe',
            // No email field
          }),
        });
      });

      const userInfo = await service.getUserInfo('test-access-token');

      // preferred_username should be used as username but NOT as email
      expect(userInfo.preferred_username).toBe('john_doe');
      expect(userInfo.email).toBeUndefined();
    });
  });

  describe('discovery cache failover', () => {
    it('should use stale cache when refetch fails', async () => {
      const mockDiscovery = {
        authorization_endpoint: 'https://keycloak.example.com/realms/test/protocol/openid-connect/auth',
        token_endpoint: 'https://keycloak.example.com/realms/test/protocol/openid-connect/token',
        userinfo_endpoint: 'https://keycloak.example.com/realms/test/protocol/openid-connect/userinfo',
        issuer: 'https://keycloak.example.com/realms/test',
      };

      // First call succeeds — populates cache
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      });

      await service.getOIDCDiscoveryDocument();

      // Expire the cache by manipulating the internal state
      (service as any).oidcDiscoveryCachedAt = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      (service as any).oidcDiscoveryPromise = null; // Clear promise to allow refetch

      // Second call fails — should fall back to stale cache
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.getOIDCDiscoveryDocument();

      expect(result).toEqual(mockDiscovery);
      expect(mockFastify.log.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Network error' }),
        'Using stale OIDC discovery cache due to fetch failure',
      );
    });
  });

  describe('nonce in generateAuthUrl', () => {
    it('should include nonce in OIDC auth URL', async () => {
      const mockDiscovery = {
        authorization_endpoint: 'https://keycloak.example.com/realms/test/protocol/openid-connect/auth',
        token_endpoint: 'https://keycloak.example.com/realms/test/protocol/openid-connect/token',
        userinfo_endpoint: 'https://keycloak.example.com/realms/test/protocol/openid-connect/userinfo',
        issuer: 'https://keycloak.example.com/realms/test',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiscovery,
      });

      const result = await service.generateAuthUrl('test-state');

      expect(result.nonce).toBeDefined();
      expect(result.nonce).toHaveLength(32); // 16 bytes hex = 32 chars
      expect(result.url).toContain('nonce=');
      expect(result.url).toContain(result.nonce);
    });
  });
});
