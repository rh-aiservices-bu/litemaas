import React, { ReactElement } from 'react';
import { render, RenderOptions, act } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { I18nextProvider } from 'react-i18next';
import { AuthProvider, AuthContext } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ConfigProvider } from '../contexts/ConfigContext';
import { testI18n } from './i18n-test-setup';
import type { Subscription } from '../services/subscriptions.service';
import { vi } from 'vitest';

// Mock ConfigContext module to provide synchronous config
vi.mock('../contexts/ConfigContext', () => {
  const React = require('react');

  // Define mock config inside the factory to avoid hoisting issues
  const mockConfig = {
    version: '1.0.0-test',
    usageCacheTTL: 300, // 5 minutes in seconds
    environment: 'test',
  };

  const mockConfigContext = React.createContext({
    config: mockConfig,
    isLoading: false,
    error: null,
  });

  return {
    useConfig: () => {
      const context = React.useContext(mockConfigContext);
      if (!context) {
        throw new Error('useConfig must be used within a ConfigProvider');
      }
      return context;
    },
    ConfigProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        mockConfigContext.Provider,
        { value: { config: mockConfig, isLoading: false, error: null } },
        children,
      ),
  };
});

// Mock config service to provide test configuration
vi.mock('../services/config.service', () => ({
  configService: {
    getConfig: vi.fn().mockResolvedValue({
      version: '1.0.0-test',
      usageCacheTTL: 300,
      environment: 'test',
    }),
  },
}));

// Create a new QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();

  // Create a memory router with future flags to avoid warnings
  const router = createTestRouter([
    {
      path: '/',
      element: (
        <ConfigProvider>
          <AuthProvider>
            <NotificationProvider>{children}</NotificationProvider>
          </AuthProvider>
        </ConfigProvider>
      ),
    },
  ]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={testI18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    </QueryClientProvider>
  );
};

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): any => {
  let result: any;
  act(() => {
    result = render(ui, { wrapper: AllTheProviders, ...options });
  });
  return result;
};

export * from '@testing-library/react';
export { customRender as render };

// Helper to wrap user events in act for cleaner tests
export const actWrappedClick = async (element: HTMLElement) => {
  await act(async () => {
    element.click();
  });
};

export const actWrappedFireEvent = {
  click: async (element: HTMLElement) => {
    await act(async () => {
      const { fireEvent } = await import('@testing-library/react');
      fireEvent.click(element);
    });
  },
  change: async (element: HTMLElement, value: any) => {
    await act(async () => {
      const { fireEvent } = await import('@testing-library/react');
      fireEvent.change(element, value);
    });
  },
};

// Export enhanced render function with better provider support
export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    initialEntries?: string[];
    user?: any;
    disableQueryClient?: boolean;
  },
) => {
  const { initialEntries, disableQueryClient, ...renderOptions } = options || {};

  const TestWrapper = ({ children }: { children: React.ReactNode }) => {
    const queryClient = disableQueryClient ? null : createTestQueryClient();

    const router = createTestRouter(
      [
        {
          path: '/*',
          element: (
            <ConfigProvider>
              <AuthProvider>
                <NotificationProvider>{children}</NotificationProvider>
              </AuthProvider>
            </ConfigProvider>
          ),
        },
      ],
      { initialEntries: initialEntries || ['/'] },
    );

    const content = (
      <I18nextProvider i18n={testI18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    );

    return queryClient ? (
      <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
    ) : (
      content
    );
  };

  let result: any;
  act(() => {
    result = render(ui, { wrapper: TestWrapper, ...renderOptions });
  });

  return result;
};

// Mock user for testing
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  roles: ['user'],
  isAdmin: false,
};

// Mock admin user for testing
export const mockAdminUser = {
  id: 'admin-user-id',
  email: 'admin@example.com',
  name: 'Admin User',
  roles: ['admin'],
  isAdmin: true,
};

// Mock admin readonly user for testing
export const mockAdminReadonlyUser = {
  id: 'admin-readonly-user-id',
  email: 'admin-readonly@example.com',
  name: 'Admin Readonly User',
  roles: ['admin-readonly'],
  isAdmin: true,
};

/**
 * Render component with custom auth state (no AuthProvider, direct context value)
 *
 * This is the recommended approach for testing components with different user roles.
 * It avoids mock conflicts by directly providing the auth context value instead of
 * using the AuthProvider component.
 *
 * @example
 * // Test with admin user
 * renderWithAuth(<AdminModelsPage />, {
 *   user: mockAdminUser
 * });
 *
 * @example
 * // Test with adminReadonly user
 * renderWithAuth(<AdminModelsPage />, {
 *   user: mockAdminReadonlyUser
 * });
 *
 * @example
 * // Test with custom user
 * renderWithAuth(<MyComponent />, {
 *   user: { id: '123', email: 'test@example.com', roles: ['user'], isAdmin: false }
 * });
 */
export const renderWithAuth = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    user?: any;
    initialEntries?: string[];
    disableQueryClient?: boolean;
  },
) => {
  const { user = mockUser, initialEntries, disableQueryClient, ...renderOptions } = options || {};

  // Create mock auth context value matching AuthContextType interface
  const authContextValue = {
    user,
    loading: false,
    isAuthenticated: !!user,
    login: vi.fn(),
    loginAsAdmin: vi.fn(),
    logout: vi.fn(async () => {}),
    refreshUser: vi.fn(async () => {}),
  };

  const TestWrapper = ({ children }: { children: React.ReactNode }) => {
    const queryClient = disableQueryClient ? null : createTestQueryClient();

    const router = createTestRouter(
      [
        {
          path: '/*',
          element: (
            <ConfigProvider>
              <AuthContext.Provider value={authContextValue}>
                <NotificationProvider>{children}</NotificationProvider>
              </AuthContext.Provider>
            </ConfigProvider>
          ),
        },
      ],
      { initialEntries: initialEntries || ['/'] },
    );

    const content = (
      <I18nextProvider i18n={testI18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    );

    return queryClient ? (
      <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
    ) : (
      content
    );
  };

  let result: any;
  act(() => {
    result = render(ui, { wrapper: TestWrapper, ...renderOptions });
  });

  return result;
};

// Standard future flags for React Router v7 preparation
export const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: true,
  v7_skipActionErrorRevalidation: true,
  v7_prependBasename: true,
};

// Helper to create memory router with standardized future flags
export const createTestRouter = (routes: any[], options: any = {}) => {
  // Do not rewrite absolute child paths; just pass through and use provided initialEntries
  return createMemoryRouter(routes, {
    initialEntries: options.initialEntries || ['/'],
    future: routerFutureFlags,
    ...options,
  });
};

// Strongly typed mock subscriptions to keep string literal unions
const mockSubscriptions: Subscription[] = [
  {
    id: 'sub-1',
    modelId: 'gpt-4',
    modelName: 'GPT-4',
    provider: 'OpenAI',
    status: 'active',
    // Real usage data matching the Subscription interface
    quotaRequests: 10000,
    quotaTokens: 1000000,
    usedRequests: 500,
    usedTokens: 50000,
    // Pricing information
    pricing: {
      inputCostPerToken: 0.00003,
      outputCostPerToken: 0.00006,
      currency: 'USD',
    },
    // Legacy fields for compatibility
    usageLimit: 1000000,
    usageUsed: 50000,
    features: ['API Access', 'Priority Support'],
    createdAt: '2024-06-24T00:00:00.000Z',
  },
];

// Mock API responses
export const mockApiResponses = {
  models: [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'OpenAI',
      description: 'Advanced language model',
      category: 'Language Model',
      contextLength: 8192,
      pricing: {
        input: 0.00003,
        output: 0.00006,
        currency: 'USD',
      },
      features: ['Code Generation', 'Creative Writing'],
      availability: 'available',
      version: '1.0',
    },
  ],
  subscriptions: mockSubscriptions,
  apiKeys: [
    {
      id: 'key-1',
      name: 'Test API Key',
      keyPreview: 'sk-...7x2K',
      status: 'active',
      permissions: ['models:read', 'completions:create'],
      usageCount: 1000,
      rateLimit: 5000,
      createdAt: '2024-06-01T00:00:00.000Z',
      lastUsed: '2024-06-23T00:00:00.000Z',
      models: ['gpt-4'],
      modelDetails: [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'OpenAI',
          contextLength: 8192,
        },
      ],
    },
  ],
  usage: {
    totalRequests: 125430,
    totalTokens: 8950000,
    totalCost: 1247.5,
    averageResponseTime: 1.2,
    successRate: 99.2,
    activeModels: 8,
  },
};
