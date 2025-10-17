#!/usr/bin/env tsx
/**
 * Recalculate Usage Cache Script
 *
 * This script recalculates the aggregated columns in the daily_usage_cache table
 * from the raw_data column. Useful for:
 * - Populating new metrics (like prompt_tokens/completion_tokens) in existing cache entries
 * - Fixing data inconsistencies
 * - Regenerating aggregations after code changes
 *
 * Usage:
 *   npm run script:recalculate-cache                    # Recalculate all records
 *   npm run script:recalculate-cache -- --dry-run       # Preview changes without updating
 *   npm run script:recalculate-cache -- --date 2025-01-15          # Single date
 *   npm run script:recalculate-cache -- --start-date 2025-01-01 --end-date 2025-01-31
 *
 * Options:
 *   --dry-run              Preview changes without updating database
 *   --date YYYY-MM-DD      Recalculate single date
 *   --start-date YYYY-MM-DD   Start of date range (inclusive)
 *   --end-date YYYY-MM-DD     End of date range (inclusive)
 *   --help                 Show this help message
 */

import Fastify from 'fastify';
import { config } from 'dotenv';
import { resolve } from 'path';
import { parseISO } from 'date-fns';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });

interface ScriptOptions {
  dryRun: boolean;
  date?: string;
  startDate?: string;
  endDate?: string;
}

interface CacheRecord {
  date: string;
  raw_data: any;
}

interface EnrichedDayData {
  date: string;
  metrics: {
    api_requests: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    spend: number;
    successful_requests: number;
    failed_requests: number;
  };
  breakdown: {
    models: Record<string, any>;
    providers: Record<string, any>;
    users: Record<string, any>;
  };
  rawData: any;
}

interface ApiKeyUserMapping {
  keyAlias: string;
  userId: string;
  username: string;
  email: string;
  role: string;
}

const UNKNOWN_USER_ID = '00000000-0000-0000-0000-000000000000';
const UNKNOWN_USERNAME = 'Unknown User';
const UNKNOWN_EMAIL = 'unknown@system.local';
const UNKNOWN_ROLE = 'user';

/**
 * Parse command line arguments
 */
function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--help':
      case '-h':
        console.log(`
Recalculate Usage Cache Script

This script recalculates aggregated columns from raw_data in daily_usage_cache.

Usage:
  npm run script:recalculate-cache                    # All records
  npm run script:recalculate-cache -- --dry-run       # Preview only
  npm run script:recalculate-cache -- --date 2025-01-15
  npm run script:recalculate-cache -- --start-date 2025-01-01 --end-date 2025-01-31

Options:
  --dry-run              Preview changes without updating database
  --date YYYY-MM-DD      Recalculate single date
  --start-date YYYY-MM-DD   Start of date range
  --end-date YYYY-MM-DD     End of date range
  --help, -h            Show this help message
        `);
        process.exit(0);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--date':
        options.date = args[++i];
        break;
      case '--start-date':
        options.startDate = args[++i];
        break;
      case '--end-date':
        options.endDate = args[++i];
        break;
    }
  }

  return options;
}

/**
 * Validate date string format
 */
function validateDate(dateStr: string, fieldName: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid ${fieldName} format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  const parsed = parseISO(dateStr);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName}: ${dateStr}`);
  }
}

/**
 * Enrich LiteLLM raw data with user mappings
 * (Simplified version of the logic from AdminUsageStatsService)
 */
async function enrichWithUserMapping(rawData: any, fastify: any): Promise<EnrichedDayData> {
  const enrichedData: EnrichedDayData = {
    date: rawData.date,
    metrics: rawData.metrics || {
      api_requests: 0,
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      spend: 0,
      successful_requests: 0,
      failed_requests: 0,
    },
    breakdown: {
      models: {},
      providers: rawData.breakdown?.providers || {},
      users: {},
    },
    rawData,
  };

  // Extract all unique key_alias values from model api_key_breakdown
  const keyAliasSet = new Set<string>();
  Object.values(rawData.breakdown?.models || {}).forEach((modelData: any) => {
    Object.values(modelData.api_keys || {}).forEach((keyData: any) => {
      if (keyData.metadata?.key_alias) {
        keyAliasSet.add(keyData.metadata.key_alias);
      }
    });
  });

  const keyAliases = Array.from(keyAliasSet);
  let apiKeyMappings: ApiKeyUserMapping[] = [];

  if (keyAliases.length > 0) {
    // Query database for API key → user mapping
    const query = `
      SELECT
        ak.litellm_key_alias,
        ak.user_id,
        ak.name as key_name,
        u.username,
        u.email,
        u.roles[1] as role
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.litellm_key_alias = ANY($1)
    `;

    try {
      const result = await fastify.pg.query(query, [keyAliases]);
      apiKeyMappings = result.rows.map((row: any) => ({
        keyAlias: row.litellm_key_alias,
        userId: row.user_id,
        username: row.username,
        email: row.email,
        role: row.role || 'user',
      }));
    } catch (error) {
      fastify.log.warn(
        { error },
        'Failed to fetch API key mappings, continuing with unknown users',
      );
    }
  }

  // Create lookup map
  const keyToUser = new Map(apiKeyMappings.map((m) => [m.keyAlias, m]));

  let mappedRequests = 0;
  let skippedRequests = 0;
  const unmappedModelMetrics: Record<string, any> = {};

  // Process model breakdown
  Object.entries(rawData.breakdown?.models || {}).forEach(
    ([modelName, modelData]: [string, any]) => {
      enrichedData.breakdown.models[modelName] = {
        metrics: {
          api_requests: modelData.metrics?.api_requests || 0,
          total_tokens: modelData.metrics?.total_tokens || 0,
          prompt_tokens: modelData.metrics?.prompt_tokens || 0,
          completion_tokens: modelData.metrics?.completion_tokens || 0,
          spend: modelData.metrics?.spend || 0,
          successful_requests: 0,
          failed_requests: 0,
        },
        users: {},
      };

      // Map API keys to users
      Object.entries(modelData.api_keys || {}).forEach(([keyHash, keyData]: [string, any]) => {
        const keyAlias = keyData.metadata?.key_alias;

        // Skip invalid keys
        const isEmptyKeyHash = !keyHash || keyHash.trim() === '';
        const isEmptyKeyAlias = !keyAlias || keyAlias.trim() === '';

        if (isEmptyKeyHash || isEmptyKeyAlias) {
          const skippedCount = keyData.metrics?.api_requests || 0;
          skippedRequests += skippedCount;
          return;
        }

        const userMapping = keyToUser.get(keyAlias);

        if (userMapping) {
          const userId = userMapping.userId;
          mappedRequests += keyData.metrics?.api_requests || 0;

          // Add to model's user breakdown
          if (!enrichedData.breakdown.models[modelName].users[userId]) {
            enrichedData.breakdown.models[modelName].users[userId] = {
              userId: userMapping.userId,
              username: userMapping.username,
              email: userMapping.email,
              metrics: {
                api_requests: 0,
                total_tokens: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                spend: 0,
                successful_requests: 0,
                failed_requests: 0,
              },
            };
          }

          // Aggregate metrics
          const userMetrics = enrichedData.breakdown.models[modelName].users[userId].metrics;
          userMetrics.api_requests += keyData.metrics?.api_requests || 0;
          userMetrics.total_tokens += keyData.metrics?.total_tokens || 0;
          userMetrics.prompt_tokens += keyData.metrics?.prompt_tokens || 0;
          userMetrics.completion_tokens += keyData.metrics?.completion_tokens || 0;
          userMetrics.spend += keyData.metrics?.spend || 0;
          userMetrics.successful_requests += keyData.metrics?.successful_requests || 0;
          userMetrics.failed_requests += keyData.metrics?.failed_requests || 0;

          // Aggregate to model metrics
          const modelMetrics = enrichedData.breakdown.models[modelName].metrics;
          modelMetrics.prompt_tokens += keyData.metrics?.prompt_tokens || 0;
          modelMetrics.completion_tokens += keyData.metrics?.completion_tokens || 0;
          modelMetrics.successful_requests += keyData.metrics?.successful_requests || 0;
          modelMetrics.failed_requests += keyData.metrics?.failed_requests || 0;

          // Add to global user breakdown
          if (!enrichedData.breakdown.users[userId]) {
            enrichedData.breakdown.users[userId] = {
              userId: userMapping.userId,
              username: userMapping.username,
              email: userMapping.email,
              role: userMapping.role,
              metrics: {
                api_requests: 0,
                total_tokens: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                spend: 0,
                successful_requests: 0,
                failed_requests: 0,
              },
              models: {},
            };
          }

          // Aggregate to user's total
          const userTotalMetrics = enrichedData.breakdown.users[userId].metrics;
          userTotalMetrics.api_requests += keyData.metrics?.api_requests || 0;
          userTotalMetrics.total_tokens += keyData.metrics?.total_tokens || 0;
          userTotalMetrics.prompt_tokens += keyData.metrics?.prompt_tokens || 0;
          userTotalMetrics.completion_tokens += keyData.metrics?.completion_tokens || 0;
          userTotalMetrics.spend += keyData.metrics?.spend || 0;
          userTotalMetrics.successful_requests += keyData.metrics?.successful_requests || 0;
          userTotalMetrics.failed_requests += keyData.metrics?.failed_requests || 0;

          // Add to user's model breakdown
          if (!enrichedData.breakdown.users[userId].models[modelName]) {
            enrichedData.breakdown.users[userId].models[modelName] = {
              modelName,
              metrics: {
                api_requests: 0,
                total_tokens: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                spend: 0,
                successful_requests: 0,
                failed_requests: 0,
              },
            };
          }

          const userModelMetrics = enrichedData.breakdown.users[userId].models[modelName].metrics;
          userModelMetrics.api_requests += keyData.metrics?.api_requests || 0;
          userModelMetrics.total_tokens += keyData.metrics?.total_tokens || 0;
          userModelMetrics.prompt_tokens += keyData.metrics?.prompt_tokens || 0;
          userModelMetrics.completion_tokens += keyData.metrics?.completion_tokens || 0;
          userModelMetrics.spend += keyData.metrics?.spend || 0;
          userModelMetrics.successful_requests += keyData.metrics?.successful_requests || 0;
          userModelMetrics.failed_requests += keyData.metrics?.failed_requests || 0;
        } else {
          // Unmapped request
          if (!unmappedModelMetrics[modelName]) {
            unmappedModelMetrics[modelName] = {
              api_requests: 0,
              total_tokens: 0,
              prompt_tokens: 0,
              completion_tokens: 0,
              spend: 0,
            };
          }
          unmappedModelMetrics[modelName].api_requests += keyData.metrics?.api_requests || 0;
          unmappedModelMetrics[modelName].total_tokens += keyData.metrics?.total_tokens || 0;
          unmappedModelMetrics[modelName].prompt_tokens += keyData.metrics?.prompt_tokens || 0;
          unmappedModelMetrics[modelName].completion_tokens +=
            keyData.metrics?.completion_tokens || 0;
          unmappedModelMetrics[modelName].spend += keyData.metrics?.spend || 0;
        }
      });

      // Adjust model metrics to exclude skipped requests
      const modelSkippedRequests = Object.entries(modelData.api_keys || {}).reduce(
        (sum, [keyHash, keyData]: [string, any]) => {
          const keyAlias = keyData.metadata?.key_alias;
          const isEmptyKeyHash = !keyHash || keyHash.trim() === '';
          const isEmptyKeyAlias = !keyAlias || keyAlias.trim() === '';
          if (isEmptyKeyHash || isEmptyKeyAlias) {
            return sum + (keyData.metrics?.api_requests || 0);
          }
          return sum;
        },
        0,
      );

      if (modelSkippedRequests > 0) {
        enrichedData.breakdown.models[modelName].metrics.api_requests -= modelSkippedRequests;
      }
    },
  );

  // Recalculate global metrics from aggregated model data
  // This replaces placeholder values with actual success/failure counts from API key data
  enrichedData.metrics.successful_requests = 0;
  enrichedData.metrics.failed_requests = 0;
  Object.values(enrichedData.breakdown.models).forEach((modelData: any) => {
    enrichedData.metrics.successful_requests += modelData.metrics.successful_requests;
    enrichedData.metrics.failed_requests += modelData.metrics.failed_requests;
  });

  // Create Unknown User for unmapped requests
  const totalUnmappedRequests =
    (rawData.metrics?.api_requests || 0) - mappedRequests - skippedRequests;

  if (totalUnmappedRequests > 0 || Object.keys(unmappedModelMetrics).length > 0) {
    const unmappedTotalMetrics = Object.values(unmappedModelMetrics).reduce(
      (acc: any, metrics: any) => ({
        api_requests: acc.api_requests + metrics.api_requests,
        total_tokens: acc.total_tokens + metrics.total_tokens,
        prompt_tokens: acc.prompt_tokens + metrics.prompt_tokens,
        completion_tokens: acc.completion_tokens + metrics.completion_tokens,
        spend: acc.spend + metrics.spend,
      }),
      { api_requests: 0, total_tokens: 0, prompt_tokens: 0, completion_tokens: 0, spend: 0 },
    );

    enrichedData.breakdown.users[UNKNOWN_USER_ID] = {
      userId: UNKNOWN_USER_ID,
      username: UNKNOWN_USERNAME,
      email: UNKNOWN_EMAIL,
      role: UNKNOWN_ROLE,
      metrics: unmappedTotalMetrics,
      models: {},
    };

    // Add to each model's Unknown User
    Object.entries(unmappedModelMetrics).forEach(([modelName, metrics]) => {
      if (metrics.api_requests > 0) {
        if (!enrichedData.breakdown.models[modelName]) {
          enrichedData.breakdown.models[modelName] = {
            metrics: rawData.breakdown.models[modelName]?.metrics || {
              api_requests: 0,
              total_tokens: 0,
              prompt_tokens: 0,
              completion_tokens: 0,
              spend: 0,
            },
            users: {},
          };
        }

        enrichedData.breakdown.models[modelName].users[UNKNOWN_USER_ID] = {
          userId: UNKNOWN_USER_ID,
          username: UNKNOWN_USERNAME,
          email: UNKNOWN_EMAIL,
          metrics,
        };

        enrichedData.breakdown.users[UNKNOWN_USER_ID].models[modelName] = {
          modelName,
          metrics,
        };
      }
    });
  }

  // Adjust global metrics
  if (skippedRequests > 0) {
    enrichedData.metrics.api_requests -= skippedRequests;
    enrichedData.metrics.successful_requests -= skippedRequests;
  }

  // Filter out models with 0 requests
  const modelsToRemove = Object.keys(enrichedData.breakdown.models).filter(
    (modelName) => enrichedData.breakdown.models[modelName].metrics.api_requests === 0,
  );

  modelsToRemove.forEach((modelName) => {
    delete enrichedData.breakdown.models[modelName];
    Object.values(enrichedData.breakdown.users).forEach((user: any) => {
      if (user.models[modelName]) {
        delete user.models[modelName];
      }
    });
  });

  return enrichedData;
}

/**
 * Main script function
 */
async function main() {
  const options = parseArgs();

  // Validate options
  if (options.date) {
    validateDate(options.date, 'date');
    if (options.startDate || options.endDate) {
      console.error('Error: Cannot use --date with --start-date or --end-date');
      process.exit(1);
    }
  } else if (options.startDate || options.endDate) {
    if (!options.startDate || !options.endDate) {
      console.error('Error: Must specify both --start-date and --end-date');
      process.exit(1);
    }
    validateDate(options.startDate, 'start-date');
    validateDate(options.endDate, 'end-date');
    if (options.startDate > options.endDate) {
      console.error('Error: start-date must be before or equal to end-date');
      process.exit(1);
    }
  }

  // Initialize Fastify
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  try {
    // Register database plugin
    await fastify.register(import('@fastify/postgres'), {
      connectionString: process.env.DATABASE_URL,
    });

    console.log('\n🔧 Recalculate Usage Cache Script');
    console.log('=====================================\n');

    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    // Build query based on options
    let query = 'SELECT date, raw_data FROM daily_usage_cache';
    const params: any[] = [];

    if (options.date) {
      query += ' WHERE date = $1';
      params.push(options.date);
      console.log(`📅 Processing single date: ${options.date}\n`);
    } else if (options.startDate && options.endDate) {
      query += ' WHERE date BETWEEN $1 AND $2';
      params.push(options.startDate, options.endDate);
      console.log(`📅 Processing date range: ${options.startDate} to ${options.endDate}\n`);
    } else {
      console.log('📅 Processing all cached records\n');
    }

    query += ' ORDER BY date ASC';

    // Fetch records
    const result = await fastify.pg.query(query, params);
    const records: CacheRecord[] = result.rows;

    if (records.length === 0) {
      console.log('✅ No records found to process');
      await fastify.close();
      return;
    }

    console.log(`📊 Found ${records.length} record(s) to process\n`);

    let successCount = 0;
    let errorCount = 0;

    // Process each record
    for (const record of records) {
      try {
        console.log(`Processing ${record.date}...`);

        // Enrich data
        const enriched = await enrichWithUserMapping(record.raw_data, fastify);

        if (options.dryRun) {
          console.log(`  ✓ Would update: ${record.date}`);
          console.log(`    - Total requests: ${enriched.metrics.api_requests}`);
          console.log(`    - Prompt tokens: ${enriched.metrics.prompt_tokens}`);
          console.log(`    - Completion tokens: ${enriched.metrics.completion_tokens}`);
          console.log(`    - Total tokens: ${enriched.metrics.total_tokens}`);
          console.log(`    - Users: ${Object.keys(enriched.breakdown.users).length}`);
          console.log(`    - Models: ${Object.keys(enriched.breakdown.models).length}`);
        } else {
          // Update database
          await fastify.pg.query(
            `UPDATE daily_usage_cache
             SET aggregated_by_user = $1,
                 aggregated_by_model = $2,
                 aggregated_by_provider = $3,
                 total_metrics = $4,
                 updated_at = NOW()
             WHERE date = $5`,
            [
              JSON.stringify(enriched.breakdown.users),
              JSON.stringify(enriched.breakdown.models),
              JSON.stringify(enriched.breakdown.providers),
              JSON.stringify(enriched.metrics),
              record.date,
            ],
          );
          console.log(
            `  ✓ Updated: ${record.date} (${enriched.metrics.api_requests} requests, ${enriched.metrics.prompt_tokens} prompt tokens, ${enriched.metrics.completion_tokens} completion tokens)`,
          );
        }

        successCount++;
      } catch (error) {
        console.error(`  ✗ Failed: ${record.date}`);
        console.error(`    Error: ${error instanceof Error ? error.message : String(error)}`);
        errorCount++;
      }
    }

    console.log('\n=====================================');
    console.log('📊 Summary');
    console.log('=====================================');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📦 Total: ${records.length}`);

    if (options.dryRun) {
      console.log('\n💡 Run without --dry-run to apply changes');
    }

    await fastify.close();
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    await fastify.close();
    process.exit(1);
  }
}

// Run the script
main();
