#!/usr/bin/env node

/**
 * CLI Backup Restore Script
 *
 * Usage: npx tsx src/scripts/restore-backup.ts --file path/to/backup.sql.gz --database litemaas|litellm
 *
 * This script is designed for catastrophic recovery scenarios where the normal
 * application is unavailable. It directly reads a backup file and restores it
 * to the specified database.
 *
 * IMPORTANT: This is a DESTRUCTIVE operation that will TRUNCATE all tables
 * and restore from the backup. Always test restore in a non-production environment first.
 */

import { config } from 'dotenv';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import * as zlib from 'zlib';

// Load environment variables
config();

interface RestoreOptions {
  file: string;
  database: 'litemaas' | 'litellm';
}

async function parseArgs(): Promise<RestoreOptions> {
  const args = process.argv.slice(2);
  let file: string | undefined;
  let database: 'litemaas' | 'litellm' | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      file = args[i + 1];
      i++;
    } else if (args[i] === '--database' && args[i + 1]) {
      const db = args[i + 1];
      if (db !== 'litemaas' && db !== 'litellm') {
        throw new Error('Database must be either "litemaas" or "litellm"');
      }
      database = db;
      i++;
    }
  }

  if (!file || !database) {
    console.error(
      'Usage: npx tsx src/scripts/restore-backup.ts --file <path> --database <litemaas|litellm>',
    );
    console.error('');
    console.error('Options:');
    console.error('  --file <path>              Path to the backup file (.sql.gz)');
    console.error('  --database <litemaas|litellm>  Target database to restore');
    console.error('');
    console.error('Example:');
    console.error(
      '  npx tsx src/scripts/restore-backup.ts --file ./backups/litemaas-backup-2024-01-01.sql.gz --database litemaas',
    );
    process.exit(1);
  }

  return { file, database };
}

async function getDatabaseUrl(database: 'litemaas' | 'litellm'): Promise<string> {
  if (database === 'litemaas') {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    return url;
  } else {
    const url = process.env.LITELLM_DATABASE_URL;
    if (!url) {
      throw new Error('LITELLM_DATABASE_URL environment variable is not set');
    }
    return url;
  }
}

async function readBackup(filePath: string): Promise<{ sqlContent: string; metadata: any }> {
  console.log(`Reading backup file: ${filePath}`);

  // Read metadata if available
  const metaPath = `${filePath}.meta.json`;
  let metadata: any = null;

  try {
    const metaContent = await fs.readFile(metaPath, 'utf-8');
    metadata = JSON.parse(metaContent);
    console.log('Backup metadata:');
    console.log(`  Database: ${metadata.database}`);
    console.log(`  Timestamp: ${metadata.timestamp}`);
    console.log(`  Tables: ${metadata.tableCount}`);
    console.log(`  Format Version: ${metadata.formatVersion}`);
  } catch (error) {
    console.warn('Warning: Could not read metadata file, continuing anyway...');
  }

  // Read and decompress backup file
  console.log('Decompressing backup...');
  const compressedData = await fs.readFile(filePath);
  const sqlContent = zlib.gunzipSync(compressedData).toString('utf-8');

  console.log(`Backup decompressed successfully (${sqlContent.length} bytes)`);

  return { sqlContent, metadata };
}

async function restoreBackup(
  databaseUrl: string,
  sqlContent: string,
  metadata: any,
): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();

    try {
      console.log('Starting transaction...');
      await client.query('BEGIN');

      console.log('Executing restore SQL...');
      console.log('⚠️  WARNING: This will TRUNCATE all tables and restore from backup!');

      // Execute the SQL content
      await client.query(sqlContent);

      console.log('Committing transaction...');
      await client.query('COMMIT');

      console.log('✅ Restore completed successfully!');

      // Verify restore if metadata is available
      if (metadata && metadata.rowCounts) {
        console.log('');
        console.log('Verifying restore:');
        for (const [table, expectedCount] of Object.entries(metadata.rowCounts)) {
          try {
            const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
            const actualCount = parseInt(result.rows[0].count, 10);

            if (actualCount === expectedCount) {
              console.log(`  ✓ ${table}: ${actualCount} rows`);
            } else {
              console.log(`  ⚠ ${table}: ${actualCount} rows (expected ${expectedCount})`);
            }
          } catch (error) {
            console.log(`  ✗ ${table}: verification failed`);
          }
        }
      }
    } catch (error) {
      console.error('Restore failed, rolling back...');
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    console.log('========================================');
    console.log('LiteMaaS Backup Restore Script');
    console.log('========================================');
    console.log('');

    // Parse command line arguments
    const options = await parseArgs();

    console.log('Configuration:');
    console.log(`  Backup file: ${options.file}`);
    console.log(`  Target database: ${options.database}`);
    console.log('');

    // Verify file exists
    try {
      await fs.access(options.file);
    } catch (error) {
      throw new Error(`Backup file not found: ${options.file}`);
    }

    // Get database URL
    const databaseUrl = await getDatabaseUrl(options.database);
    console.log(`  Database URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
    console.log('');

    // Confirm with user
    console.log('⚠️  WARNING: This operation will TRUNCATE all tables and restore from backup!');
    console.log('⚠️  Make sure you have a backup of your current data before proceeding!');
    console.log('');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('');

    // Read backup
    const { sqlContent, metadata } = await readBackup(options.file);

    // Restore backup
    await restoreBackup(databaseUrl, sqlContent, metadata);

    console.log('');
    console.log('========================================');
    console.log('Restore completed successfully!');
    console.log('========================================');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('========================================');
    console.error('Restore failed!');
    console.error('========================================');
    console.error('');

    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(`Error: ${String(error)}`);
    }

    console.error('');
    process.exit(1);
  }
}

main();
