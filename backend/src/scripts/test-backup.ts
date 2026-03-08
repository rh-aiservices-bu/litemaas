#!/usr/bin/env node

/**
 * CLI Backup Test Script
 *
 * Standalone script to test the streaming backup against a live database
 * without needing the full application running.
 *
 * Usage:
 *   npx tsx src/scripts/test-backup.ts --database litemaas|litellm [--output path/to/output.sql.gz]
 *
 * Environment variables:
 *   DATABASE_URL         - LiteMaaS database connection string
 *   LITELLM_DATABASE_URL - LiteLLM database connection string
 *
 * Examples:
 *   # Test against local LiteMaaS database (uses DATABASE_URL from .env)
 *   npx tsx src/scripts/test-backup.ts --database litemaas
 *
 *   # Test against production LiteLLM database
 *   LITELLM_DATABASE_URL="postgresql://user:pass@host:5432/litellm" npx tsx src/scripts/test-backup.ts --database litellm
 *
 *   # Custom output path
 *   npx tsx src/scripts/test-backup.ts --database litellm --output /tmp/test-backup.sql.gz
 */

import { Pool, PoolClient } from 'pg';
import { promises as fs } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

// Load environment variables from .env if dotenv is available (not needed in pods)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  // dotenv not installed — env vars expected to be set by deployment
}

// PostgreSQL OIDs for type-aware serialization
const PG_JSON_OID = 114;
const PG_JSONB_OID = 3802;
const PG_TIMESTAMP_OID = 1114;
const PG_TIMESTAMPTZ_OID = 1184;

const CURSOR_BATCH_SIZE = 1000;

interface TestOptions {
  database: 'litemaas' | 'litellm';
  output: string;
}

function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  let database: 'litemaas' | 'litellm' | undefined;
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--database' && args[i + 1]) {
      const db = args[i + 1];
      if (db !== 'litemaas' && db !== 'litellm') {
        throw new Error('Database must be either "litemaas" or "litellm"');
      }
      database = db;
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      output = args[i + 1];
      i++;
    }
  }

  if (!database) {
    console.error(
      'Usage: npx tsx src/scripts/test-backup.ts --database <litemaas|litellm> [--output <path>]',
    );
    console.error('');
    console.error('Options:');
    console.error('  --database <litemaas|litellm>  Target database to backup');
    console.error(
      '  --output <path>               Output file path (default: ./data/backups/test-backup-<db>.sql.gz)',
    );
    console.error('');
    console.error('Environment variables:');
    console.error('  DATABASE_URL           LiteMaaS database connection string');
    console.error('  LITELLM_DATABASE_URL   LiteLLM database connection string');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const defaultOutput = `./data/backups/test-backup-${database}-${timestamp}.sql.gz`;

  return { database, output: output || defaultOutput };
}

function getDatabaseUrl(database: 'litemaas' | 'litellm'): string {
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

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function escapeSQLValue(value: any, isJsonColumn = false, isTimestamp = false): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (isTimestamp && typeof value === 'string') {
    return `'${value}'`;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  if (Array.isArray(value)) {
    if (isJsonColumn) {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }
    const elements = value.map((v) => {
      if (v === null || v === undefined) return 'NULL';
      const escaped = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    return `'{${elements.join(',')}}'`;
  }

  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

async function streamTableBackup(
  client: PoolClient,
  table: string,
  write: (data: string) => Promise<void>,
  rowCounts: Record<string, number>,
): Promise<void> {
  const quotedTable = quoteIdentifier(table);

  const metaResult = await client.query(`SELECT * FROM ${quotedTable} LIMIT 0`);
  const fields = metaResult.fields;

  if (fields.length === 0) {
    rowCounts[table] = 0;
    await write(`-- Table: ${table} (no columns)\n\n`);
    return;
  }

  const columns = fields.map((f) => f.name);
  const quotedColumns = columns.map((c) => quoteIdentifier(c)).join(', ');

  const jsonColumns = new Set(
    fields
      .filter((f) => f.dataTypeID === PG_JSON_OID || f.dataTypeID === PG_JSONB_OID)
      .map((f) => f.name),
  );
  const timestampColumns = new Set(
    fields
      .filter((f) => f.dataTypeID === PG_TIMESTAMP_OID || f.dataTypeID === PG_TIMESTAMPTZ_OID)
      .map((f) => f.name),
  );

  const selectColumns = fields
    .map((f) => {
      if (f.dataTypeID === PG_TIMESTAMP_OID || f.dataTypeID === PG_TIMESTAMPTZ_OID) {
        return `${quoteIdentifier(f.name)}::text AS ${quoteIdentifier(f.name)}`;
      }
      return quoteIdentifier(f.name);
    })
    .join(', ');

  const cursorName = `backup_${table.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  await client.query(
    `DECLARE ${quoteIdentifier(cursorName)} CURSOR FOR SELECT ${selectColumns} FROM ${quotedTable}`,
  );

  await write(`-- Table: ${table}\n`);
  await write(`TRUNCATE TABLE ${quotedTable} CASCADE;\n`);

  let totalRows = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const batch = await client.query(
        `FETCH ${CURSOR_BATCH_SIZE} FROM ${quoteIdentifier(cursorName)}`,
      );
      if (batch.rows.length === 0) {
        hasMore = false;
        break;
      }

      totalRows += batch.rows.length;

      for (const row of batch.rows) {
        const values = columns.map((col) =>
          escapeSQLValue(row[col], jsonColumns.has(col), timestampColumns.has(col)),
        );
        await write(
          `INSERT INTO ${quotedTable} (${quotedColumns}) VALUES (${values.join(', ')});\n`,
        );
      }

      // Progress indicator for large tables
      if (totalRows % 10000 === 0) {
        process.stdout.write(`    ... ${totalRows} rows\n`);
      }
    }
  } finally {
    await client.query(`CLOSE ${quoteIdentifier(cursorName)}`);
  }

  rowCounts[table] = totalRows;
  await write('\n');
}

async function main() {
  const options = parseArgs();

  console.log('========================================');
  console.log('LiteMaaS Streaming Backup Test');
  console.log('========================================');
  console.log('');

  const databaseUrl = getDatabaseUrl(options.database);
  console.log(`Database:    ${options.database}`);
  console.log(`URL:         ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Output:      ${options.output}`);
  console.log(`Batch size:  ${CURSOR_BATCH_SIZE} rows`);
  console.log('');

  // Ensure output directory exists
  await fs.mkdir(path.dirname(options.output), { recursive: true });

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Discover tables
    console.log('Discovering tables...');
    const tableResult = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    const tables = tableResult.rows.map((row) => row.tablename);
    console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);
    console.log('');

    // Set up streaming gzip writer
    const gzip = zlib.createGzip();
    const fileStream = createWriteStream(options.output);
    gzip.pipe(fileStream);

    const write = (data: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const ok = gzip.write(data);
        if (ok) {
          resolve();
        } else {
          gzip.once('drain', resolve);
          gzip.once('error', reject);
        }
      });
    };

    const rowCounts: Record<string, number> = {};
    const startTime = Date.now();

    // Track memory usage
    const startMem = process.memoryUsage();
    let peakHeapUsed = startMem.heapUsed;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const timestamp = new Date().toISOString();
      await write(`-- Database backup for ${options.database}\n`);
      await write(`-- Generated at ${timestamp}\n\n`);

      for (const table of tables) {
        process.stdout.write(`  Backing up: ${table}...`);
        const tableStart = Date.now();

        await streamTableBackup(client, table, write, rowCounts);

        const tableDuration = Date.now() - tableStart;
        const currentMem = process.memoryUsage();
        peakHeapUsed = Math.max(peakHeapUsed, currentMem.heapUsed);

        console.log(
          ` ${rowCounts[table]} rows (${tableDuration}ms, heap: ${Math.round(currentMem.heapUsed / 1024 / 1024)}MB)`,
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Finalize gzip stream
    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
      gzip.on('error', reject);
      gzip.end();
    });

    const duration = Date.now() - startTime;
    const stats = await fs.stat(options.output);
    const totalRows = Object.values(rowCounts).reduce((sum, count) => sum + count, 0);

    console.log('');
    console.log('========================================');
    console.log('Backup completed successfully!');
    console.log('========================================');
    console.log(`  Tables:      ${tables.length}`);
    console.log(`  Total rows:  ${totalRows}`);
    console.log(`  File size:   ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Duration:    ${(duration / 1000).toFixed(1)}s`);
    console.log(`  Peak heap:   ${Math.round(peakHeapUsed / 1024 / 1024)} MB`);
    console.log(`  Output:      ${options.output}`);
    console.log('');

    // Verify the backup file can be decompressed (stream just the first bytes)
    console.log('Verifying backup file integrity...');
    const header = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      const gunzip = zlib.createGunzip();
      const readStream = createReadStream(options.output);

      gunzip.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        totalBytes += chunk.length;
        if (totalBytes >= 200) {
          readStream.destroy();
          gunzip.destroy();
          resolve(Buffer.concat(chunks).subarray(0, 200).toString('utf-8'));
        }
      });
      gunzip.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      });
      gunzip.on('error', reject);
      readStream.on('error', reject);

      readStream.pipe(gunzip);
    });

    if (header.includes('-- Database backup for')) {
      console.log('  File integrity: OK');
    } else {
      console.error('  File integrity: FAILED - unexpected header');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('========================================');
    console.error('Backup FAILED!');
    console.error('========================================');

    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        console.error('');
        console.error(error.stack);
      }
    } else {
      console.error(`Error: ${String(error)}`);
    }

    // Clean up partial file
    try {
      await fs.unlink(options.output);
    } catch {
      // ignore
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
