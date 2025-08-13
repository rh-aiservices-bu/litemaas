import { vi } from 'vitest';
import type { User } from '../../services/auth.service';
import type { Model, ProvidersResponse, CapabilitiesResponse } from '../../services/models.service';
import { mockApiResponses } from '../test-utils';

/**
 * Service Mock Factory
 *
 * Provides consistent, reusable mock implementations for all services
 * to ensure predictable behavior across tests and reduce duplication.
 *
 * Key principles:
 * - All mocks return realistic data structures
 * - Methods are vi.fn() for assertion testing
 * - Async methods return resolved promises
 * - Mock data is consistent with actual API responses
 */

// Default mock user for auth service
const defaultMockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  username: 'testuser',
  roles: ['user'],
};

/**
 * Creates a mock auth service with customizable behavior
 */
export const createAuthServiceMock = (
  overrides?: Partial<{
    isAuthenticated: boolean;
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
  }>,
) => {
  const config = {
    isAuthenticated: true,
    user: defaultMockUser,
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    ...overrides,
  };

  return {
    isAuthenticated: vi.fn(() => config.isAuthenticated),
    getCurrentUser: vi.fn(() =>
      config.user ? Promise.resolve(config.user) : Promise.reject(new Error('Not authenticated')),
    ),
    logout: vi.fn(() => Promise.resolve()),
    refreshToken: vi.fn(() =>
      Promise.resolve({
        access_token: config.accessToken || 'new-access-token',
        refresh_token: config.refreshToken || 'new-refresh-token',
        user: config.user || defaultMockUser,
      }),
    ),
    setTokens: vi.fn(),
    getAccessToken: vi.fn(() => config.accessToken),
    getRefreshToken: vi.fn(() => config.refreshToken),
  };
};

/**
 * Creates a mock models service with realistic responses
 */
export const createModelsServiceMock = (
  overrides?: Partial<{
    models: Model[];
    providers: ProvidersResponse['providers'];
    capabilities: CapabilitiesResponse['capabilities'];
  }>,
) => {
  const config = {
    models: mockApiResponses.models,
    providers: [
      {
        name: 'openai',
        displayName: 'OpenAI',
        modelCount: 5,
        capabilities: ['chat', 'completion'],
      },
      { name: 'anthropic', displayName: 'Anthropic', modelCount: 3, capabilities: ['chat'] },
    ],
    capabilities: [
      { name: 'chat', displayName: 'Chat', description: 'Conversational AI', modelCount: 8 },
      { name: 'vision', displayName: 'Vision', description: 'Image understanding', modelCount: 2 },
    ],
    ...overrides,
  };

  return {
    getModels: vi.fn(
      (page = 1, limit = 20, search?: string, provider?: string, _capability?: string) => {
        let filteredModels = [...config.models];

        // Apply filters if provided
        if (search) {
          filteredModels = filteredModels.filter(
            (m) =>
              m.name.toLowerCase().includes(search.toLowerCase()) ||
              m.description.toLowerCase().includes(search.toLowerCase()),
          );
        }
        if (provider && provider !== 'all') {
          filteredModels = filteredModels.filter((m) => m.provider === provider);
        }

        return Promise.resolve({
          models: filteredModels,
          pagination: {
            page,
            limit,
            total: filteredModels.length,
            totalPages: Math.ceil(filteredModels.length / limit),
          },
        });
      },
    ),
    getModel: vi.fn((id: string) => {
      const model = config.models.find((m) => m.id === id);
      return model ? Promise.resolve(model) : Promise.reject(new Error('Model not found'));
    }),
    getProviders: vi.fn(() => Promise.resolve({ providers: config.providers })),
    getCapabilities: vi.fn(() => Promise.resolve({ capabilities: config.capabilities })),
    refreshModels: vi.fn(() => Promise.resolve()),
  };
};

/**
 * Creates a mock subscriptions service
 */
export const createSubscriptionsServiceMock = (
  overrides?: Partial<{
    subscriptions: typeof mockApiResponses.subscriptions;
  }>,
) => {
  const config = {
    subscriptions: mockApiResponses.subscriptions,
    ...overrides,
  };

  return {
    getSubscriptions: vi.fn((page = 1, limit = 20) =>
      Promise.resolve({
        data: config.subscriptions,
        pagination: {
          page,
          limit,
          total: config.subscriptions.length,
          totalPages: Math.ceil(config.subscriptions.length / limit),
        },
      }),
    ),
    getSubscription: vi.fn((id: string) => {
      const subscription = config.subscriptions.find((s) => s.id === id);
      return subscription
        ? Promise.resolve(subscription)
        : Promise.reject(new Error('Subscription not found'));
    }),
    createSubscription: vi.fn((data) =>
      Promise.resolve({
        ...config.subscriptions[0],
        ...data,
        id: `sub-${Date.now()}`,
      }),
    ),
    updateSubscription: vi.fn((id, data) => {
      const subscription = config.subscriptions.find((s) => s.id === id);
      return subscription
        ? Promise.resolve({ ...subscription, ...data })
        : Promise.reject(new Error('Subscription not found'));
    }),
    deleteSubscription: vi.fn(() => Promise.resolve()),
  };
};

/**
 * Creates a mock API keys service
 */
export const createApiKeysServiceMock = (
  overrides?: Partial<{
    apiKeys: typeof mockApiResponses.apiKeys;
  }>,
) => {
  const config = {
    apiKeys: mockApiResponses.apiKeys,
    ...overrides,
  };

  return {
    getApiKeys: vi.fn((page = 1, limit = 20) =>
      Promise.resolve({
        data: config.apiKeys,
        pagination: {
          page,
          limit,
          total: config.apiKeys.length,
          totalPages: Math.ceil(config.apiKeys.length / limit),
        },
      }),
    ),
    getApiKey: vi.fn((id: string) => {
      const apiKey = config.apiKeys.find((k) => k.id === id);
      return apiKey ? Promise.resolve(apiKey) : Promise.reject(new Error('API key not found'));
    }),
    createApiKey: vi.fn((data) =>
      Promise.resolve({
        ...config.apiKeys[0],
        ...data,
        id: `key-${Date.now()}`,
        key: `sk-${Math.random().toString(36).substr(2, 9)}`,
      }),
    ),
    updateApiKey: vi.fn((id, data) => {
      const apiKey = config.apiKeys.find((k) => k.id === id);
      return apiKey
        ? Promise.resolve({ ...apiKey, ...data })
        : Promise.reject(new Error('API key not found'));
    }),
    deleteApiKey: vi.fn(() => Promise.resolve()),
    retrieveFullKey: vi.fn((_id: string) =>
      Promise.resolve({
        key: `sk-full-${Math.random().toString(36).substr(2, 9)}`,
      }),
    ),
  };
};

/**
 * Creates a mock usage service
 */
export const createUsageServiceMock = (
  overrides?: Partial<{
    usage: typeof mockApiResponses.usage;
  }>,
) => {
  const config = {
    usage: mockApiResponses.usage,
    ...overrides,
  };

  return {
    getUsageStats: vi.fn(() => Promise.resolve(config.usage)),
    getUsageHistory: vi.fn(() =>
      Promise.resolve({
        data: [
          { date: '2024-06-01', requests: 1000, tokens: 50000, cost: 15.5 },
          { date: '2024-06-02', requests: 1200, tokens: 60000, cost: 18.2 },
        ],
        summary: config.usage,
      }),
    ),
    getModelUsage: vi.fn((modelId: string) =>
      Promise.resolve({
        modelId,
        totalRequests: 5000,
        totalTokens: 250000,
        totalCost: 75.5,
        dailyUsage: [{ date: '2024-06-01', requests: 500, tokens: 25000, cost: 7.5 }],
      }),
    ),
  };
};

/**
 * Creates a mock config service
 */
export const createConfigServiceMock = (
  overrides?: Partial<{
    authEnabled: boolean;
    mockAuthEnabled: boolean;
    apiUrl: string;
    environment: string;
  }>,
) => {
  const config = {
    authEnabled: true,
    mockAuthEnabled: false,
    apiUrl: 'http://localhost:3000',
    environment: 'test',
    ...overrides,
  };

  return {
    isAuthEnabled: vi.fn(() => config.authEnabled),
    isMockAuthEnabled: vi.fn(() => config.mockAuthEnabled),
    getApiUrl: vi.fn(() => config.apiUrl),
    getEnvironment: vi.fn(() => config.environment),
    getConfig: vi.fn(() =>
      Promise.resolve({
        auth: {
          enabled: config.authEnabled,
          mockEnabled: config.mockAuthEnabled,
          provider: 'oauth2',
        },
        api: {
          url: config.apiUrl,
          timeout: 30000,
        },
        environment: config.environment,
        features: {
          darkMode: true,
          notifications: true,
        },
      }),
    ),
  };
};

/**
 * Helper to create all service mocks at once
 */
export const createAllServiceMocks = (overrides?: {
  auth?: Parameters<typeof createAuthServiceMock>[0];
  models?: Parameters<typeof createModelsServiceMock>[0];
  subscriptions?: Parameters<typeof createSubscriptionsServiceMock>[0];
  apiKeys?: Parameters<typeof createApiKeysServiceMock>[0];
  usage?: Parameters<typeof createUsageServiceMock>[0];
  config?: Parameters<typeof createConfigServiceMock>[0];
}) => {
  return {
    authService: createAuthServiceMock(overrides?.auth),
    modelsService: createModelsServiceMock(overrides?.models),
    subscriptionsService: createSubscriptionsServiceMock(overrides?.subscriptions),
    apiKeysService: createApiKeysServiceMock(overrides?.apiKeys),
    usageService: createUsageServiceMock(overrides?.usage),
    configService: createConfigServiceMock(overrides?.config),
  };
};

/**
 * Utility to setup service mocks in tests
 *
 * Usage:
 * ```typescript
 * import { setupServiceMocks } from '../mocks/service-mock-factory';
 *
 * const mocks = setupServiceMocks({
 *   auth: { isAuthenticated: false }
 * });
 *
 * // Access individual mocks for assertions
 * expect(mocks.authService.getCurrentUser).toHaveBeenCalled();
 * ```
 */
export const setupServiceMocks = (overrides?: Parameters<typeof createAllServiceMocks>[0]) => {
  const mocks = createAllServiceMocks(overrides);

  // Set up vi.mock calls
  vi.mock('../../services/auth.service', () => ({
    authService: mocks.authService,
  }));

  vi.mock('../../services/models.service', () => ({
    modelsService: mocks.modelsService,
  }));

  vi.mock('../../services/subscriptions.service', () => ({
    subscriptionsService: mocks.subscriptionsService,
  }));

  vi.mock('../../services/apiKeys.service', () => ({
    apiKeysService: mocks.apiKeysService,
  }));

  vi.mock('../../services/usage.service', () => ({
    usageService: mocks.usageService,
  }));

  vi.mock('../../services/config.service', () => ({
    configService: mocks.configService,
  }));

  return mocks;
};
