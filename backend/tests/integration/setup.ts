// Mock JWT functionality since we don't need real JWT in tests
const jwt = {
  sign: (payload: any, secret: string) => {
    // Return a simple base64-encoded payload for testing
    return `mock-jwt-${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
  },
};

/**
 * Generate a test JWT token for authentication in integration tests
 * @param userId - User ID to include in token
 * @param roles - Array of user roles
 * @param iat - Issued at timestamp (defaults to current time)
 * @returns JWT token string
 */
export function generateTestToken(
  userId: string = 'user-123',
  roles: string[] = ['user'],
  iat: number = Math.floor(Date.now() / 1000),
): string {
  const payload = {
    sub: userId,
    email: 'test@example.com',
    name: 'Test User',
    roles,
    iat,
    exp: iat + 3600, // 1 hour expiry
  };

  // Use a test secret for generating tokens
  const testSecret = process.env.JWT_SECRET || 'test-secret-key';
  return jwt.sign(payload, testSecret);
}

/**
 * Generate an expired test token
 * @param userId - User ID to include in token
 * @param roles - Array of user roles
 * @returns Expired JWT token string
 */
export function generateExpiredToken(
  userId: string = 'user-123',
  roles: string[] = ['user'],
): string {
  const payload = {
    sub: userId,
    email: 'test@example.com',
    name: 'Test User',
    roles,
    iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
  };

  const testSecret = process.env.JWT_SECRET || 'test-secret-key';
  return jwt.sign(payload, testSecret);
}

/**
 * Mock data for testing
 */
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
  keyAlias: 'test-key_a1b2c3d4',
  permissions: ['models:read', 'completions:create'],
  rateLimit: 1000,
  usageCount: 0,
  status: 'active',
  createdAt: new Date().toISOString(),
  expiresAt: null,
  models: ['gpt-4', 'claude-3-opus'],
  metadata: {},
};

export const mockSubscription = {
  id: 'sub-123',
  userId: 'user-123',
  modelId: 'gpt-4',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  quotas: {
    requests: { limit: 10000, used: 100 },
    tokens: { limit: 1000000, used: 5000 },
  },
};
