#!/usr/bin/env node

/**
 * LiteMaaS User Properties Reset Script
 * 
 * This script allows administrators to reset user properties (max_budget, tpm_limit, rpm_limit)
 * for either all users or a specific user. It updates both the LiteMaaS database and LiteLLM.
 * 
 * Usage:
 *   cd backend && npx ts-node ../scripts/reset-user-properties.ts
 *   or
 *   cd backend && npm run reset-user-properties
 * 
 * Environment:
 *   Requires backend/.env file with DATABASE_URL, LITELLM_API_URL, and LITELLM_API_KEY
 */

import { Pool, PoolClient } from 'pg';
import * as readline from 'readline/promises';
import { config } from 'dotenv';
import path from 'path';
import { LiteLLMService } from '../backend/src/services/litellm.service';
import type { DatabaseUtils } from '../backend/src/types/common.types';
import type { LiteLLMUserRequest } from '../backend/src/types/user.types';

// Load backend environment variables
config({ path: path.join(__dirname, '../backend/.env') });

interface User {
  id: string;
  username: string;
  email: string;
  max_budget: number;
  tpm_limit: number;
  rpm_limit: number;
}

interface UpdateInputs {
  scope: string;
  username?: string;
  maxBudget?: number;
  tpmLimit?: number;
  rpmLimit?: number;
}

interface UpdateResults {
  success: string[];
  failed: Array<{ username: string; error: Error }>;
}

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// Validate environment variables
function validateEnvironment(): void {
  const required = ['DATABASE_URL', 'LITELLM_API_URL', 'LITELLM_API_KEY'];
  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error(colorize('❌ Missing required environment variables:', 'red'));
    missing.forEach(env => console.error(`  - ${env}`));
    console.error(colorize('\n💡 Make sure backend/.env file exists and contains all required variables', 'yellow'));
    process.exit(1);
  }
}

// Create database connection using existing patterns
function createDatabaseUtils(): DatabaseUtils {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5, // Limit connections for script
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return {
    query: async (text: string, params?: any[]) => {
      const result = await pool.query(text, params);
      return result;
    },
    
    queryOne: async <T>(text: string, params?: any[]): Promise<T | null> => {
      const result = await pool.query(text, params);
      return result.rows[0] || null;
    },
    
    queryMany: async <T>(text: string, params?: any[]): Promise<T[]> => {
      const result = await pool.query(text, params);
      return result.rows;
    },
    
    withTransaction: async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    
    // Add method to close the pool
    close: async () => {
      await pool.end();
    }
  } as DatabaseUtils & { close: () => Promise<void> };
}

// Create LiteLLM service using existing patterns
function createLiteLLMService(): LiteLLMService {
  // Create a minimal Fastify-like logger for the service
  const logger = {
    info: (...args: any[]) => console.log(colorize('[INFO]', 'blue'), ...args),
    error: (...args: any[]) => console.error(colorize('[ERROR]', 'red'), ...args),
    warn: (...args: any[]) => console.warn(colorize('[WARN]', 'yellow'), ...args),
    debug: (...args: any[]) => console.debug(colorize('[DEBUG]', 'cyan'), ...args),
    fatal: (...args: any[]) => console.error(colorize('[FATAL]', 'red'), ...args),
    trace: (...args: any[]) => console.trace(colorize('[TRACE]', 'magenta'), ...args),
    child: () => logger
  };

  // Create minimal Fastify instance mock for the service
  const fastifyMock = {
    log: logger
  } as any;

  return new LiteLLMService(fastifyMock, {
    baseURL: process.env.LITELLM_API_URL!,
    apiKey: process.env.LITELLM_API_KEY!,
    enableMocking: process.env.LITELLM_ENABLE_MOCKING === 'true',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  });
}

// Interactive user input functions
async function promptUser(): Promise<UpdateInputs> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log(colorize('🔧 LiteMaaS User Properties Reset Tool', 'bright'));
    console.log(colorize('==========================================\n', 'bright'));
    
    // Ask for scope
    console.log('Choose update scope:');
    console.log('  - Type "all" to update all active users');
    console.log('  - Type a username to update a specific user\n');
    
    const scope = await rl.question('Apply changes to (all/username): ');
    
    let username: string | undefined;
    if (scope.toLowerCase() !== 'all') {
      username = scope.trim();
      if (!username) {
        throw new Error('Username cannot be empty');
      }
    }
    
    console.log('\n' + colorize('Property Values (press Enter to skip a property):', 'yellow'));
    
    // Get new values (empty = keep current)
    const maxBudgetStr = await rl.question('New max_budget ($): ');
    const tpmLimitStr = await rl.question('New tpm_limit (tokens/min): ');
    const rpmLimitStr = await rl.question('New rpm_limit (requests/min): ');
    
    // Validate numeric inputs
    const maxBudget = maxBudgetStr.trim() ? parseFloat(maxBudgetStr) : undefined;
    const tpmLimit = tpmLimitStr.trim() ? parseInt(tpmLimitStr) : undefined;
    const rpmLimit = rpmLimitStr.trim() ? parseInt(rpmLimitStr) : undefined;
    
    if (maxBudget !== undefined && (isNaN(maxBudget) || maxBudget < 0)) {
      throw new Error('max_budget must be a non-negative number');
    }
    
    if (tpmLimit !== undefined && (isNaN(tpmLimit) || tpmLimit < 0)) {
      throw new Error('tpm_limit must be a non-negative integer');
    }
    
    if (rpmLimit !== undefined && (isNaN(rpmLimit) || rpmLimit < 0)) {
      throw new Error('rpm_limit must be a non-negative integer');
    }
    
    if (maxBudget === undefined && tpmLimit === undefined && rpmLimit === undefined) {
      throw new Error('At least one property must be specified');
    }
    
    return {
      scope: scope.toLowerCase() === 'all' ? 'all' : 'user',
      username,
      maxBudget,
      tpmLimit,
      rpmLimit
    };
  } finally {
    rl.close();
  }
}

// Confirm user action
async function confirmAction(inputs: UpdateInputs, userCount: number): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log('\n' + colorize('📊 Summary of changes:', 'bright'));
    console.log(''.padEnd(50, '='));
    
    if (inputs.scope === 'all') {
      console.log(`Scope: ${colorize(`All active users (${userCount} users)`, 'yellow')}`);
    } else {
      console.log(`Scope: ${colorize(`User: ${inputs.username}`, 'yellow')}`);
    }
    
    if (inputs.maxBudget !== undefined) {
      console.log(`Max Budget: ${colorize(`$${inputs.maxBudget}`, 'cyan')}`);
    }
    if (inputs.tpmLimit !== undefined) {
      console.log(`TPM Limit: ${colorize(`${inputs.tpmLimit} tokens/min`, 'cyan')}`);
    }
    if (inputs.rpmLimit !== undefined) {
      console.log(`RPM Limit: ${colorize(`${inputs.rpmLimit} requests/min`, 'cyan')}`);
    }
    
    console.log(''.padEnd(50, '='));
    console.log(colorize('\n⚠️  This will update both LiteMaaS database AND LiteLLM!', 'yellow'));
    
    const confirm = await rl.question('\nProceed with updates? (yes/no): ');
    return confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

// Get users from database
async function getUsers(dbUtils: DatabaseUtils, username?: string): Promise<User[]> {
  const query = `
    SELECT id, username, email, max_budget, tpm_limit, rpm_limit 
    FROM users 
    WHERE is_active = true 
      AND ($1::text IS NULL OR username = $1)
    ORDER BY username
  `;
  
  return await dbUtils.queryMany<User>(query, [username || null]);
}

// Update users in both database and LiteLLM
async function updateUsers(
  dbUtils: DatabaseUtils,
  litellmService: LiteLLMService,
  users: User[],
  updates: Partial<{ maxBudget: number; tpmLimit: number; rpmLimit: number }>
): Promise<UpdateResults> {
  const results: UpdateResults = { success: [], failed: [] };
  
  console.log(colorize(`\n🔄 Processing ${users.length} user(s)...`, 'bright'));
  console.log(''.padEnd(50, '-'));
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const progress = `[${i + 1}/${users.length}]`;
    
    try {
      // Update database first
      await dbUtils.query(
        `UPDATE users 
         SET max_budget = COALESCE($2, max_budget),
             tpm_limit = COALESCE($3, tpm_limit),
             rpm_limit = COALESCE($4, rpm_limit),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [user.id, updates.maxBudget, updates.tpmLimit, updates.rpmLimit]
      );
      
      // Prepare LiteLLM update payload
      const litellmUpdates: Partial<LiteLLMUserRequest> = {};
      if (updates.maxBudget !== undefined) litellmUpdates.max_budget = updates.maxBudget;
      if (updates.tpmLimit !== undefined) litellmUpdates.tpm_limit = updates.tpmLimit;
      if (updates.rpmLimit !== undefined) litellmUpdates.rpm_limit = updates.rpmLimit;
      
      // Update LiteLLM
      await litellmService.updateUser(user.id, litellmUpdates);
      
      results.success.push(user.username);
      console.log(`${colorize('✅', 'green')} ${progress} Updated: ${colorize(user.username, 'bright')} (${user.email})`);
      
    } catch (error) {
      results.failed.push({ username: user.username, error: error as Error });
      console.error(`${colorize('❌', 'red')} ${progress} Failed: ${colorize(user.username, 'bright')} - ${(error as Error).message}`);
    }
  }
  
  return results;
}

// Main execution function
async function main(): Promise<void> {
  console.log(colorize('🚀 Starting LiteMaaS User Properties Reset Script\n', 'bright'));
  
  // Validate environment
  validateEnvironment();
  
  // Initialize services
  const dbUtils = createDatabaseUtils() as DatabaseUtils & { close: () => Promise<void> };
  const litellmService = createLiteLLMService();
  
  try {
    // Get user inputs
    const inputs = await promptUser();
    
    // Get users to update
    const users = await getUsers(dbUtils, inputs.username);
    
    if (users.length === 0) {
      if (inputs.username) {
        console.error(colorize(`❌ User '${inputs.username}' not found or is not active`, 'red'));
      } else {
        console.error(colorize('❌ No active users found', 'red'));
      }
      process.exit(1);
    }
    
    // Confirm action
    const confirmed = await confirmAction(inputs, users.length);
    if (!confirmed) {
      console.log(colorize('❌ Operation cancelled by user', 'yellow'));
      process.exit(0);
    }
    
    // Execute updates
    const results = await updateUsers(dbUtils, litellmService, users, {
      maxBudget: inputs.maxBudget,
      tpmLimit: inputs.tpmLimit,
      rpmLimit: inputs.rpmLimit
    });
    
    // Report results
    console.log('\n' + colorize('📈 Results Summary:', 'bright'));
    console.log(''.padEnd(50, '='));
    console.log(`${colorize('✅ Successfully updated:', 'green')} ${results.success.length} users`);
    if (results.failed.length > 0) {
      console.log(`${colorize('❌ Failed updates:', 'red')} ${results.failed.length} users`);
      console.log('\nFailed users:');
      results.failed.forEach(({ username, error }) => {
        console.log(`  - ${username}: ${error.message}`);
      });
    }
    
    if (results.success.length > 0) {
      console.log(colorize('\n🎉 Script completed successfully!', 'green'));
    } else {
      console.log(colorize('\n⚠️  No users were updated', 'yellow'));
      process.exit(1);
    }
    
  } catch (error) {
    console.error(colorize('❌ Script error:', 'red'), (error as Error).message);
    console.error('\nFull error details:');
    console.error(error);
    process.exit(1);
  } finally {
    // Clean up database connection
    await dbUtils.close();
  }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', async () => {
  console.log(colorize('\n\n❌ Script interrupted by user', 'yellow'));
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log(colorize('\n\n❌ Script terminated', 'yellow'));
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error(colorize('❌ Unhandled error:', 'red'), error);
    process.exit(1);
  });
}