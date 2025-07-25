import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../src/app';

declare global {
  var testApp: FastifyInstance;
}

// Global test setup
beforeAll(async () => {
  // Build test app instance
  global.testApp = await createApp({
    logger: false,
  });

  // Register test-specific plugins or overrides
  await global.testApp.register(async function (fastify) {
    // Override authentication for testing
    fastify.decorate('authenticateWithDevBypass', async (request: any, reply: any) => {
      // Mock user for testing
      request.user = mockUser;
    });

    fastify.decorate('authenticate', async (request: any, reply: any) => {
      // Mock user for testing
      request.user = mockUser;
    });

    // Override database connection for testing
    fastify.decorate('db', {
      query: async (text: string, params?: any[]) => {
        // Mock database queries for testing
        return { rows: [], rowCount: 0 };
      },
      pool: {
        connect: async () => ({
          query: async () => ({ rows: [], rowCount: 0 }),
          release: () => {},
        }),
      },
    });

    // Override dbUtils for testing
    fastify.decorate('dbUtils', {
      async query(text: string, params?: any[]) {
        // Mock database queries for testing
        return { rows: [], rowCount: 0 };
      },
      async queryOne(text: string, params?: any[]) {
        // Mock single row query for testing
        return null;
      },
      async queryMany(text: string, params?: any[]) {
        // Mock multiple rows query for testing
        return [];
      },
      async withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
        // Simulate transaction in mock mode
        const mockClient = { query: () => Promise.resolve({ rows: [] }) };
        return callback(mockClient);
      },
    });

    // Mock Fastify error methods
    fastify.decorate('createError', (statusCode: number, message: string) => {
      const error = new Error(message) as any;
      error.statusCode = statusCode;
      return error;
    });

    fastify.decorate('createNotFoundError', (resource: string) => {
      const error = new Error(`${resource} not found`) as any;
      error.statusCode = 404;
      return error;
    });

    fastify.decorate('createValidationError', (message: string) => {
      const error = new Error(message) as any;
      error.statusCode = 400;
      return error;
    });

    // Override LiteLLM service for testing
    fastify.decorate('litellm', {
      getModels: async () => mockModels,
      getModel: async (id: string) => mockModels.find(m => m.id === id),
      createCompletion: async () => mockCompletion,
    });
  });

  await global.testApp.ready();
});

afterAll(async () => {
  if (global.testApp) {
    await global.testApp.close();
  }
});

beforeEach(() => {
  // Reset mocks before each test
});

afterEach(() => {
  // Cleanup after each test
});

// Mock data
export const mockModels = [
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
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    description: 'Most capable model',
    category: 'Language Model',
    contextLength: 200000,
    pricing: { input: 0.015, output: 0.075 },
    features: ['Long Context', 'Analysis'],
    availability: 'available',
    version: '3.0',
  },
];

export const mockCompletion = {
  id: 'completion-123',
  object: 'text_completion',
  created: Date.now(),
  model: 'gpt-4',
  choices: [
    {
      text: 'Hello! How can I help you today?',
      index: 0,
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 8,
    total_tokens: 18,
  },
};

export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  roles: ['user'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockApiKey = {
  id: 'key-123',
  userId: 'user-123',
  name: 'Test Key',
  keyHash: 'hashed-key',
  keyPreview: 'sk-...abc123',
  permissions: ['models:read', 'completions:create'],
  rateLimit: 1000,
  usageCount: 0,
  status: 'active',
  createdAt: new Date().toISOString(),
  expiresAt: null,
};