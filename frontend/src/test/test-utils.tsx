import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { I18nextProvider } from 'react-i18next';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import i18n from '../i18n';

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

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </I18nextProvider>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Mock user for testing
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  roles: ['user'],
  isAdmin: false,
};

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
      pricing: { input: 0.03, output: 0.06 },
      features: ['Code Generation', 'Creative Writing'],
      availability: 'available',
      version: '1.0',
    },
  ],
  subscriptions: [
    {
      id: 'sub-1',
      modelId: 'gpt-4',
      modelName: 'GPT-4',
      provider: 'OpenAI',
      status: 'active',
      plan: 'professional',
      usageLimit: 100000,
      usageUsed: 65000,
      billingCycle: 'monthly',
      nextBillingDate: '2024-07-24',
      costPerMonth: 50,
      features: ['API Access', 'Priority Support'],
      createdAt: '2024-06-24',
    },
  ],
  apiKeys: [
    {
      id: 'key-1',
      name: 'Test API Key',
      keyPreview: 'sk-...7x2K',
      status: 'active',
      permissions: ['models:read', 'completions:create'],
      usageCount: 1000,
      rateLimit: 5000,
      createdAt: '2024-06-01',
      lastUsed: '2024-06-23',
    },
  ],
  usage: {
    totalRequests: 125430,
    totalTokens: 8950000,
    totalCost: 1247.50,
    averageResponseTime: 1.2,
    successRate: 99.2,
    activeModels: 8,
  },
};