import { http, HttpResponse } from 'msw';

// Utility to check if request was aborted
const checkAbortSignal = (request: Request) => {
  if (request.signal && request.signal.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError');
  }
};

// Mock data for API responses
const mockBackendApiKeys = [
  {
    id: 'key-1',
    subscriptionId: 'sub-1',
    userId: 'user-1',
    name: 'Test API Key',
    keyPrefix: 'sk-test123',
    liteLLMKey: 'sk-test123456789abcdef',
    liteLLMKeyId: 'litellm-key-1',
    models: ['gpt-4', 'gpt-3.5-turbo'],
    modelDetails: [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'OpenAI',
        contextLength: 8192,
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'OpenAI',
        contextLength: 4096,
      },
    ],
    lastUsedAt: '2024-06-23T00:00:00.000Z',
    expiresAt: '2026-06-01T00:00:00.000Z',
    isActive: true,
    createdAt: '2024-06-01T00:00:00.000Z',
    revokedAt: null,
    metadata: {
      permissions: ['models:read', 'completions:create'],
      ratelimit: 5000,
      description: 'Test API key for development',
    },
  },
  {
    id: 'key-2',
    subscriptionId: 'sub-2',
    userId: 'user-1',
    name: 'Expired API Key',
    keyPrefix: 'sk-expired',
    liteLLMKey: null,
    liteLLMKeyId: 'litellm-key-2',
    models: ['gpt-3.5-turbo'],
    modelDetails: [
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'OpenAI',
        contextLength: 4096,
      },
    ],
    lastUsedAt: '2024-05-15T00:00:00.000Z',
    expiresAt: '2024-05-31T00:00:00.000Z',
    isActive: true,
    createdAt: '2024-05-01T00:00:00.000Z',
    revokedAt: null,
    metadata: {
      permissions: ['models:read'],
      ratelimit: 1000,
    },
  },
  {
    id: 'key-3',
    subscriptionId: 'sub-3',
    userId: 'user-1',
    name: 'Revoked API Key',
    keyPrefix: 'sk-revoked',
    liteLLMKey: null,
    liteLLMKeyId: 'litellm-key-3',
    models: ['gpt-4'],
    modelDetails: [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'OpenAI',
        contextLength: 8192,
      },
    ],
    lastUsedAt: '2024-04-10T00:00:00.000Z',
    expiresAt: null,
    isActive: false,
    createdAt: '2024-04-01T00:00:00.000Z',
    revokedAt: '2024-04-15T00:00:00.000Z',
    metadata: {
      permissions: ['models:read', 'completions:create'],
      ratelimit: 2000,
    },
  },
];

const mockUsageMetrics = {
  totalRequests: 125430,
  totalTokens: 8950000,
  totalCost: 1247.5,
  averageResponseTime: 1.2,
  successRate: 99.2,
  activeModels: 8,
  topModels: [
    { name: 'GPT-4', requests: 50000, tokens: 4000000, cost: 800.0 },
    { name: 'GPT-3.5 Turbo', requests: 40000, tokens: 2500000, cost: 250.0 },
    { name: 'Claude', requests: 20000, tokens: 1500000, cost: 150.0 },
  ],
  dailyUsage: [
    { date: '2024-06-01', requests: 5000, tokens: 400000, cost: 50.0 },
    { date: '2024-06-02', requests: 4500, tokens: 360000, cost: 45.0 },
    { date: '2024-06-03', requests: 6000, tokens: 480000, cost: 60.0 },
  ],
  hourlyUsage: [
    { hour: '00:00', requests: 100 },
    { hour: '01:00', requests: 80 },
    { hour: '02:00', requests: 60 },
  ],
  errorBreakdown: [
    { type: 'Rate Limit', count: 50, percentage: 2.1 },
    { type: 'Authentication', count: 30, percentage: 1.3 },
    { type: 'Network', count: 20, percentage: 0.8 },
  ],
};

export const handlers = [
  // API Keys endpoints
  http.get('/api/v1/api-keys', ({ request }) => {
    // Check if request was aborted
    checkAbortSignal(request);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedKeys = mockBackendApiKeys.slice(startIndex, endIndex);

    return HttpResponse.json({
      data: paginatedKeys,
      total: mockBackendApiKeys.length,
    });
  }),

  http.get('/api/v1/api-keys/:keyId', ({ params }) => {
    const { keyId } = params;
    const apiKey = mockBackendApiKeys.find((key) => key.id === keyId);

    if (!apiKey) {
      return HttpResponse.json({ message: 'API key not found', statusCode: 404 }, { status: 404 });
    }

    return HttpResponse.json(apiKey);
  }),

  http.post('/api/v1/api-keys', async ({ request }) => {
    const body = (await request.json()) as any;

    // Simulate validation errors
    if (body.name === 'invalid-key') {
      return HttpResponse.json(
        { message: 'Invalid API key name', statusCode: 400 },
        { status: 400 },
      );
    }

    const newKey = {
      id: `key-${Date.now()}`,
      subscriptionId: body.subscriptionId,
      userId: 'user-1',
      name: body.name || 'New API Key',
      keyPrefix: 'sk-new123',
      liteLLMKey: 'sk-new123456789abcdef',
      liteLLMKeyId: `litellm-key-${Date.now()}`,
      models: body.modelIds || ['gpt-3.5-turbo'],
      modelDetails: [
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'OpenAI',
          contextLength: 4096,
        },
      ],
      lastUsedAt: new Date().toISOString(),
      expiresAt: body.expiresAt,
      isActive: true,
      createdAt: new Date().toISOString(),
      revokedAt: null,
      metadata: body.metadata || {},
    };

    mockBackendApiKeys.push(newKey);
    return HttpResponse.json(newKey, { status: 201 });
  }),

  http.patch('/api/v1/api-keys/:keyId', async ({ params, request }) => {
    const { keyId } = params;
    const updates = (await request.json()) as any;

    const keyIndex = mockBackendApiKeys.findIndex((key) => key.id === keyId);
    if (keyIndex === -1) {
      return HttpResponse.json({ message: 'API key not found', statusCode: 404 }, { status: 404 });
    }

    // Simulate update error
    if (updates.name === 'error-update') {
      return HttpResponse.json({ message: 'Update failed', statusCode: 500 }, { status: 500 });
    }

    const updatedKey = { ...mockBackendApiKeys[keyIndex], ...updates };
    mockBackendApiKeys[keyIndex] = updatedKey;

    return HttpResponse.json(updatedKey);
  }),

  http.delete('/api/v1/api-keys/:keyId', ({ params }) => {
    const { keyId } = params;
    const keyIndex = mockBackendApiKeys.findIndex((key) => key.id === keyId);

    if (keyIndex === -1) {
      return HttpResponse.json({ message: 'API key not found', statusCode: 404 }, { status: 404 });
    }

    // Simulate deletion error
    if (keyId === 'error-delete') {
      return HttpResponse.json({ message: 'Deletion failed', statusCode: 500 }, { status: 500 });
    }

    // Don't actually remove from mock data to avoid interfering with other tests
    // mockBackendApiKeys.splice(keyIndex, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // API Key reveal endpoint
  http.post('/api/v1/api-keys/:keyId/reveal', ({ params }) => {
    const { keyId } = params;

    // Simulate various error cases first
    if (keyId === 'token-too-old') {
      return HttpResponse.json(
        {
          message: 'Recent authentication required for this operation',
          statusCode: 403,
          code: 'TOKEN_TOO_OLD',
        },
        { status: 403 },
      );
    }

    if (keyId === 'rate-limited') {
      return HttpResponse.json(
        {
          message: 'Too many requests',
          statusCode: 429,
          code: 'KEY_OPERATION_RATE_LIMITED',
          details: { retryAfter: 300 },
        },
        { status: 429 },
      );
    }

    const apiKey = mockBackendApiKeys.find((key) => key.id === keyId);

    if (!apiKey) {
      return HttpResponse.json({ message: 'API key not found', statusCode: 404 }, { status: 404 });
    }

    if (!apiKey.isActive) {
      return HttpResponse.json(
        { message: 'Cannot reveal inactive API key', statusCode: 403 },
        { status: 403 },
      );
    }

    if (apiKey.revokedAt) {
      return HttpResponse.json(
        { message: 'Cannot reveal revoked API key', statusCode: 403 },
        { status: 403 },
      );
    }

    return HttpResponse.json({
      key: apiKey.liteLLMKey || 'sk-revealed-key-123456789',
      keyType: 'LiteLLM',
      retrievedAt: new Date().toISOString(),
    });
  }),

  // Usage endpoints
  http.get('/api/v1/usage/metrics', ({ request }) => {
    const url = new URL(request.url);
    const modelId = url.searchParams.get('modelId');
    const apiKeyId = url.searchParams.get('apiKeyId');

    // Simulate filtered responses based on query parameters
    let metrics = { ...mockUsageMetrics };

    if (modelId === 'gpt-4') {
      metrics = {
        ...metrics,
        totalRequests: 50000,
        totalTokens: 4000000,
        totalCost: 800.0,
      };
    }

    if (apiKeyId === 'key-1') {
      metrics = {
        ...metrics,
        totalRequests: 25000,
        totalTokens: 2000000,
        totalCost: 400.0,
      };
    }

    return HttpResponse.json(metrics);
  }),

  // Usage export endpoint
  http.get('/api/v1/usage/export', ({ request }) => {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'csv';

    if (format === 'csv') {
      const csvContent = `Date,Requests,Tokens,Cost\n2024-06-01,5000,400000,50.0\n2024-06-02,4500,360000,45.0`;
      return HttpResponse.text(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="usage_export.csv"',
        },
      });
    }

    if (format === 'json') {
      return HttpResponse.json(mockUsageMetrics.dailyUsage);
    }

    return HttpResponse.json({ message: 'Unsupported format', statusCode: 400 }, { status: 400 });
  }),

  // Config endpoint (frequently requested, was missing)
  http.get('/api/v1/config', () => {
    return HttpResponse.json({
      auth: {
        enabled: true,
        provider: 'oauth2',
      },
      features: {
        modelSync: true,
        apiKeys: true,
      },
    });
  }),

  // Error simulation endpoints
  http.get('/api/v1/test-error', () => {
    return HttpResponse.json(
      { message: 'Internal server error', statusCode: 500 },
      { status: 500 },
    );
  }),

  http.get('/api/v1/test-timeout', () => {
    // Simulate timeout by not responding
    return new Promise(() => {});
  }),
];
