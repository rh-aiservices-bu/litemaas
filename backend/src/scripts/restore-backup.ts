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
import { Pool, PoolClient } from 'pg';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
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

async function readMetadata(filePath: string): Promise<any> {
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
  } catch {
    console.warn('Warning: Could not read metadata file, continuing anyway...');
  }

  return metadata;
}

/**
 * Stream-decompress a backup file and execute SQL statements in batches.
 * Avoids loading the entire decompressed SQL into memory.
 */
async function streamRestoreSQL(backupPath: string, client: PoolClient): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const gunzip = zlib.createGunzip();
    const readStream = createReadStream(backupPath);
    let buffer = '';
    let statementsExecuted = 0;

    gunzip.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');

      const lastNewline = buffer.lastIndexOf('\n');
      if (lastNewline === -1) return;

      const processable = buffer.substring(0, lastNewline);
      buffer = buffer.substring(lastNewline + 1);

      const statements = processable.split('\n').filter((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      });

      if (statements.length > 0) {
        gunzip.pause();
        statementsExecuted += statements.length;

        if (statementsExecuted % 10000 === 0) {
          process.stdout.write(`  ... ${statementsExecuted} statements executed\n`);
        }

        const batch = statements.join('\n');
        client
          .query(batch)
          .then(() => {
            gunzip.resume();
          })
          .catch((err) => {
            readStream.destroy();
            gunzip.destroy();
            reject(err);
          });
      }
    });

    gunzip.on('end', () => {
      const remaining = buffer.split('\n').filter((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      });

      if (remaining.length > 0) {
        client
          .query(remaining.join('\n'))
          .then(() => {
            console.log(`  Total: ${statementsExecuted + remaining.length} statements executed`);
            resolve();
          })
          .catch(reject);
      } else {
        console.log(`  Total: ${statementsExecuted} statements executed`);
        resolve();
      }
    });

    gunzip.on('error', reject);
    readStream.on('error', reject);

    readStream.pipe(gunzip);
  });
}

async function restoreBackup(
  databaseUrl: string,
  backupPath: string,
  metadata: any,
): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();

    try {
      console.log('Starting transaction...');
      await client.query('BEGIN');

      console.log('Executing restore SQL (streaming)...');
      console.log('⚠️  WARNING: This will TRUNCATE all tables and restore from backup!');

      await streamRestoreSQL(backupPath, client);

      console.log('Committing transaction...');
      await client.query('COMMIT');

      console.log('✅ Restore completed successfully!');

      // Verify restore if metadata is available
      if (metadata && metadata.rowCounts) {
        console.log('');
        console.log('Verifying restore:');
        for (const [table, expectedCount] of Object.entries(metadata.rowCounts)) {
          try {
            const result = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
            const actualCount = parseInt(result.rows[0].count, 10);

            if (actualCount === expectedCount) {
              console.log(`  ✓ ${table}: ${actualCount} rows`);
            } else {
              console.log(`  ⚠ ${table}: ${actualCount} rows (expected ${expectedCount})`);
            }
          } catch {
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

    // Read metadata
    const metadata = await readMetadata(options.file);

    // Restore backup (streaming)
    await restoreBackup(databaseUrl, options.file, metadata);

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
