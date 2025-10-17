// Use real JWT library for proper signature verification in integration tests
import jwt from 'jsonwebtoken';
import { FastifyInstance } from 'fastify';

/**
 * CRITICAL: Safety check to prevent tests from running against non-test databases
 */
function verifyTestDatabase() {
  const dbUrl = process.env.DATABASE_URL || '';

  // Check that we're using a test database
  if (!dbUrl.includes('litemaas_test')) {
    throw new Error(
      '🚨 CRITICAL ERROR: Tests must run against litemaas_test database!\n' +
        `Current DATABASE_URL: ${dbUrl}\n` +
        'Tests WILL NOT run against development or production databases.\n' +
        'Please check backend/vitest.config.ts configuration.',
    );
  }

  // Additional check: warn if database name contains 'prod' or is exactly 'litemaas'
  if (dbUrl.includes('/litemaas_prod') || dbUrl.includes('/litemaas_production')) {
    throw new Error('🚨 CRITICAL: Tests detected production database URL!');
  }

  if (dbUrl.endsWith('/litemaas')) {
    throw new Error(
      '🚨 CRITICAL: Tests detected development database URL!\n' +
        'Database URL ends with /litemaas instead of /litemaas_test',
    );
  }

  console.log('✅ Test database verification passed: Using litemaas_test');
}

// Run verification immediately
verifyTestDatabase();

/**
 * Fixed UUIDs for test users to ensure consistent test data
 * Exported early so it can be used by generateTestToken default parameter
 */
export const TEST_USER_IDS = {
  USER: '00000000-0000-4000-8000-000000000001',
  ADMIN: '00000000-0000-4000-8000-000000000002',
  ADMIN_READONLY: '00000000-0000-4000-8000-000000000003',
};

/**
 * Generate a test JWT token for authentication in integration tests
 * @param userId - User ID to include in token (defaults to TEST_USER_IDS.USER)
 * @param roles - Array of user roles
 * @param iat - Issued at timestamp (defaults to current time)
 * @returns JWT token string
 */
export function generateTestToken(
  userId: string = TEST_USER_IDS.USER,
  roles: string[] = ['user'],
  iat: number = Math.floor(Date.now() / 1000),
): string {
  // Determine username based on user ID
  let username = 'testuser';
  let email = 'test@example.com';
  if (userId === TEST_USER_IDS.ADMIN) {
    username = 'testadmin';
    email = 'admin@example.com';
  } else if (userId === TEST_USER_IDS.ADMIN_READONLY) {
    username = 'testadminreadonly';
    email = 'adminreadonly@example.com';
  }

  const payload = {
    userId, // Use userId field as expected by JWTPayload interface
    username, // Add username field as expected by JWTPayload interface
    email,
    roles,
    iat,
    exp: iat + 3600, // 1 hour expiry
  };

  // Use the same test secret as configured in vitest.config.ts
  const testSecret = process.env.JWT_SECRET || 'test-secret-key-for-vitest-testing';
  return jwt.sign(payload, testSecret);
}

/**
 * Generate an expired test token
 * @param userId - User ID to include in token (defaults to TEST_USER_IDS.USER)
 * @param roles - Array of user roles
 * @returns Expired JWT token string
 */
export function generateExpiredToken(
  userId: string = TEST_USER_IDS.USER,
  roles: string[] = ['user'],
): string {
  // Determine username based on user ID
  let username = 'testuser';
  let email = 'test@example.com';
  if (userId === TEST_USER_IDS.ADMIN) {
    username = 'testadmin';
    email = 'admin@example.com';
  } else if (userId === TEST_USER_IDS.ADMIN_READONLY) {
    username = 'testadminreadonly';
    email = 'adminreadonly@example.com';
  }

  const payload = {
    userId, // Use userId field as expected by JWTPayload interface
    username, // Add username field as expected by JWTPayload interface
    email,
    roles,
    iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
  };

  const testSecret = process.env.JWT_SECRET || 'test-secret-key-for-vitest-testing';
  return jwt.sign(payload, testSecret);
}

/**
 * Mock data for testing
 */
export const mockUser = {
  id: '00000000-0000-4000-8000-000000000123', // Valid UUID replacing legacy 'user-123'
  email: 'test@example.com',
  name: 'Test User',
  roles: ['user'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockApiKey = {
  id: 'key-123',
  userId: '00000000-0000-4000-8000-000000000123', // Valid UUID replacing legacy 'user-123'
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
  userId: '00000000-0000-4000-8000-000000000123', // Valid UUID replacing legacy 'user-123'
  modelId: 'gpt-4',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  quotas: {
    requests: { limit: 10000, used: 100 },
    tokens: { limit: 1000000, used: 5000 },
  },
};

/**
 * Create test users in database for integration tests
 * This ensures JWT tokens can be validated against actual database records
 * @param app - Fastify application instance
 */
export async function createTestUsers(app: FastifyInstance): Promise<void> {
  const testUsers = [
    {
      id: TEST_USER_IDS.USER,
      username: 'testuser',
      email: 'test@example.com',
      full_name: 'Test User',
      roles: ['user'],
    },
    {
      id: TEST_USER_IDS.ADMIN,
      username: 'testadmin',
      email: 'admin@example.com',
      full_name: 'Test Admin',
      roles: ['admin'],
    },
    {
      id: TEST_USER_IDS.ADMIN_READONLY,
      username: 'testadminreadonly',
      email: 'adminreadonly@example.com',
      full_name: 'Test Admin Readonly',
      roles: ['admin-readonly'],
    },
    // Legacy test users for backward compatibility with existing tests
    // Using valid UUIDs instead of string IDs
    {
      id: '00000000-0000-4000-8000-000000000123', // Legacy equivalent of 'user-123'
      username: 'legacyuser',
      email: 'legacyuser@example.com',
      full_name: 'Legacy Test User',
      roles: ['user'],
    },
    {
      id: '00000000-0000-4000-8000-000000000456', // Legacy equivalent of 'admin-123'
      username: 'legacyadmin',
      email: 'legacyadmin@example.com',
      full_name: 'Legacy Test Admin',
      roles: ['admin'],
    },
  ];

  for (const user of testUsers) {
    try {
      // First, delete audit logs for users we're about to update/delete to avoid foreign key constraints
      await app.dbUtils.query(
        'DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3)',
        [user.username, user.email, user.id],
      );

      // Then, try to delete any existing users with the same username or email
      // but different IDs (from previous test runs with non-UUID IDs)
      await app.dbUtils.query(
        'DELETE FROM users WHERE (username = $1 OR email = $2) AND id != $3',
        [user.username, user.email, user.id],
      );

      // Use INSERT ... ON CONFLICT to handle existing users with the same ID
      await app.dbUtils.query(
        `INSERT INTO users (id, username, email, full_name, oauth_provider, oauth_id, roles, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username,
           email = EXCLUDED.email,
           full_name = EXCLUDED.full_name,
           oauth_provider = EXCLUDED.oauth_provider,
           oauth_id = EXCLUDED.oauth_id,
           roles = EXCLUDED.roles,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [user.id, user.username, user.email, user.full_name, 'test', user.id, user.roles, true],
      );
      console.log(`✓ Created/updated test user: ${user.username} (${user.id})`);
    } catch (error) {
      // Log error but continue - makes helper resilient to different database states
      console.log(
        `✗ Failed to create test user ${user.username}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
