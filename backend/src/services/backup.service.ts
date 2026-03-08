import { FastifyInstance } from 'fastify';
import { BaseService } from './base.service';
import { Pool, PoolClient } from 'pg';
import { promises as fs } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import {
  BackupCapabilities,
  BackupDatabaseType,
  BackupInfo,
  BackupJobStatus,
  BackupMetadata,
  RestoreResult,
  TestRestoreResult,
} from '../types/backup.types';
import { ApplicationError } from '../utils/errors';

/**
 * BackupService - Handles database backup and restore operations
 *
 * Extends BaseService for consistent error handling and database operations.
 * Supports backup/restore for both LiteMaaS and LiteLLM databases.
 */
export class BackupService extends BaseService {
  private readonly BACKUP_FORMAT_VERSION = '1.0.0';
  private readonly APP_VERSION = '1.0.0';
  private readonly DEFAULT_STORAGE_PATH = './data/backups';

  // LiteMaaS table order (respects FK dependencies)
  private readonly LITEMAAS_TABLES = [
    'users',
    'teams',
    'team_members',
    'models',
    'subscriptions',
    'api_keys',
    'api_key_models',
    'audit_logs',
    'refresh_tokens',
    'oauth_sessions',
    'banner_announcements',
    'user_banner_dismissals',
    'banner_audit_log',
    'subscription_status_history',
    'daily_usage_cache',
    'branding_settings',
    'system_settings',
  ];

  // In-memory job state (singleton per pod — only one backup at a time)
  private jobStatus: BackupJobStatus = { state: 'idle' };
  private jobStartTime = 0;

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  /**
   * Get the current backup job status.
   * Called by the frontend on mount and during polling.
   */
  getJobStatus(): BackupJobStatus {
    // Update elapsed time for running jobs
    if (this.jobStatus.state === 'running' && this.jobStatus.progress) {
      this.jobStatus.progress.elapsed = Math.round((Date.now() - this.jobStartTime) / 1000);
    }
    return { ...this.jobStatus };
  }

  /**
   * Start a backup job in the background.
   * Returns immediately with status. The frontend polls getJobStatus() for progress.
   */
  startBackupJob(dbType: BackupDatabaseType, userId: string): BackupJobStatus {
    if (this.jobStatus.state === 'running') {
      throw ApplicationError.validation(
        'A backup is already in progress',
        'database',
        this.jobStatus.database,
      );
    }

    this.jobStartTime = Date.now();
    this.jobStatus = {
      state: 'running',
      database: dbType,
      startedAt: new Date().toISOString(),
      progress: {
        currentTable: '',
        tablesCompleted: 0,
        tablesTotal: 0,
        rowsProcessed: 0,
        rowsTotal: 0,
        elapsed: 0,
      },
    };

    // Fire and forget — errors are captured in jobStatus
    this.runBackupJob(dbType, userId).catch((error) => {
      this.fastify.log.error({ error, dbType }, 'Background backup job failed');
    });

    return this.getJobStatus();
  }

  /**
   * Run the backup job in the background, updating progress as it goes.
   */
  private async runBackupJob(dbType: BackupDatabaseType, userId: string): Promise<void> {
    try {
      const backupInfo = await this.createBackup(dbType);

      this.jobStatus = {
        state: 'completed',
        database: dbType,
        backup: backupInfo,
        startedAt: this.jobStatus.startedAt,
        completedAt: new Date().toISOString(),
      };

      // Audit log
      try {
        await this.fastify.pg.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, success, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            userId,
            'backup:create',
            'backup',
            backupInfo.id,
            true,
            JSON.stringify({
              database: dbType,
              filename: backupInfo.filename,
              size: backupInfo.size,
              tableCount: backupInfo.metadata.tableCount,
            }),
          ],
        );
      } catch (auditError) {
        this.fastify.log.error({ error: auditError }, 'Failed to log backup audit trail');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.jobStatus = {
        state: 'failed',
        database: dbType,
        error: errorMessage,
        startedAt: this.jobStatus.startedAt,
        completedAt: new Date().toISOString(),
      };

      // Audit log failure
      try {
        await this.fastify.pg.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, success, error_message, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            userId,
            'backup:create',
            'backup',
            dbType,
            false,
            errorMessage,
            JSON.stringify({ database: dbType }),
          ],
        );
      } catch (auditError) {
        this.fastify.log.error({ error: auditError }, 'Failed to log backup audit trail');
      }
    }
  }

  /**
   * Get backup capabilities - checks database availability and storage path
   */
  async getCapabilities(): Promise<BackupCapabilities> {
    const litemaasAvailable = !!this.fastify.pg;
    const litellmConfigured = !!process.env.LITELLM_DATABASE_URL;
    let litellmAvailable = false;

    if (litellmConfigured) {
      try {
        const pool = new Pool({ connectionString: process.env.LITELLM_DATABASE_URL });
        await pool.query('SELECT 1');
        litellmAvailable = true;
        await pool.end();
      } catch (error) {
        this.fastify.log.warn({ error }, 'LiteLLM database not available');
      }
    }

    const storagePath = process.env.BACKUP_STORAGE_PATH || this.DEFAULT_STORAGE_PATH;

    // Ensure storage directory exists
    try {
      await fs.mkdir(storagePath, { recursive: true });
    } catch (error) {
      this.fastify.log.error({ error, storagePath }, 'Failed to create backup storage directory');
    }

    return {
      litemaasAvailable,
      litellmAvailable,
      litellmConfigured,
      storagePath,
    };
  }

  /**
   * Create a backup of the specified database.
   * Uses streaming with cursors to avoid loading entire tables into memory.
   */
  async createBackup(dbType: BackupDatabaseType): Promise<BackupInfo> {
    const capabilities = await this.getCapabilities();

    if (dbType === 'litemaas' && !capabilities.litemaasAvailable) {
      throw this.createValidationError('LiteMaaS database is not available', 'database');
    }

    if (dbType === 'litellm' && !capabilities.litellmAvailable) {
      throw this.createValidationError('LiteLLM database is not available', 'database');
    }

    const timestamp = new Date().toISOString();
    const filename = `${dbType}-backup-${timestamp.replace(/:/g, '-')}.sql.gz`;
    const storagePath = capabilities.storagePath;
    const backupPath = path.join(storagePath, filename);
    const metaPath = path.join(storagePath, `${filename}.meta.json`);

    try {
      // Get database pool
      let pool: Pool | undefined;
      let shouldClosePool = false;

      if (dbType === 'litemaas') {
        pool = this.fastify.pg.pool;
      } else {
        pool = new Pool({ connectionString: process.env.LITELLM_DATABASE_URL });
        shouldClosePool = true;
      }

      if (!pool) {
        throw this.createValidationError('Database pool not available', 'database');
      }

      // Get tables to backup
      const tables = await this.getTableList(pool, dbType);

      // Stream backup SQL directly to gzip file using cursors
      const rowCounts = await this.streamBackupSQL(pool, tables, dbType, backupPath, timestamp);

      // Create metadata
      const metadata: BackupMetadata = {
        formatVersion: this.BACKUP_FORMAT_VERSION,
        database: dbType,
        timestamp,
        appVersion: this.APP_VERSION,
        tableCount: tables.length,
        rowCounts,
      };

      // Save metadata
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

      // Get file size
      const stats = await fs.stat(backupPath);

      // Close pool if we created it
      if (shouldClosePool && pool) {
        await pool.end();
      }

      const backupInfo: BackupInfo = {
        id: filename,
        filename,
        database: dbType,
        timestamp,
        size: stats.size,
        metadata,
      };

      this.fastify.log.info({ backupInfo }, 'Backup created successfully');

      return backupInfo;
    } catch (error) {
      // Clean up partial files
      try {
        await fs.unlink(backupPath);
      } catch {
        // Ignore cleanup errors
      }
      try {
        await fs.unlink(metaPath);
      } catch {
        // Ignore cleanup errors
      }

      this.fastify.log.error({ error, dbType }, 'Failed to create backup');
      throw this.mapDatabaseError(error as Error, 'creating backup');
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    const capabilities = await this.getCapabilities();
    const storagePath = capabilities.storagePath;

    try {
      const files = await fs.readdir(storagePath);
      const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

      const backups: BackupInfo[] = [];

      for (const metaFile of metaFiles) {
        const metaPath = path.join(storagePath, metaFile);
        const backupFile = metaFile.replace('.meta.json', '');
        const backupPath = path.join(storagePath, backupFile);

        try {
          // Read metadata
          const metaContent = await fs.readFile(metaPath, 'utf-8');
          const metadata: BackupMetadata = JSON.parse(metaContent);

          // Get file size
          const stats = await fs.stat(backupPath);

          backups.push({
            id: backupFile,
            filename: backupFile,
            database: metadata.database,
            timestamp: metadata.timestamp,
            size: stats.size,
            metadata,
          });
        } catch (error) {
          this.fastify.log.warn({ error, metaFile }, 'Failed to read backup metadata');
        }
      }

      // Sort by timestamp descending
      backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return backups;
    } catch (error) {
      this.fastify.log.error({ error, storagePath }, 'Failed to list backups');
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw ApplicationError.internal('Failed to list backups', { error: errorMessage });
    }
  }

  /**
   * Get the full path for a backup file (with sanitization)
   */
  getBackupPath(id: string): string {
    // Sanitize the ID to prevent path traversal
    const sanitized = id.replace(/\.\./g, '').replace(/\//g, '').replace(/\\/g, '');

    if (sanitized !== id) {
      throw this.createValidationError('Invalid backup ID', 'id', id);
    }

    const capabilities = this.getCapabilitiesSync();
    return path.join(capabilities.storagePath, sanitized);
  }

  /**
   * Delete a backup
   */
  async deleteBackup(id: string): Promise<void> {
    const backupPath = this.getBackupPath(id);
    const metaPath = `${backupPath}.meta.json`;

    try {
      // Delete both files
      await fs.unlink(backupPath);
      await fs.unlink(metaPath);

      this.fastify.log.info({ id }, 'Backup deleted successfully');
    } catch (error) {
      this.fastify.log.error({ error, id }, 'Failed to delete backup');
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw ApplicationError.internal('Failed to delete backup', { error: errorMessage });
    }
  }

  /**
   * Restore a backup to the specified database.
   * Streams the backup file and executes SQL statements in batches to avoid OOM.
   */
  async restoreBackup(id: string, dbType: BackupDatabaseType): Promise<RestoreResult> {
    const backupPath = this.getBackupPath(id);
    const metaPath = `${backupPath}.meta.json`;

    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Read metadata
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const metadata: BackupMetadata = JSON.parse(metaContent);

      // Validate database type matches
      if (metadata.database !== dbType) {
        warnings.push(`Backup was created for ${metadata.database} but restoring to ${dbType}`);
      }

      // Get database pool
      let pool: Pool | undefined;
      let shouldClosePool = false;

      if (dbType === 'litemaas') {
        pool = this.fastify.pg.pool;
      } else {
        const capabilities = await this.getCapabilities();
        if (!capabilities.litellmAvailable) {
          throw this.createValidationError('LiteLLM database is not available', 'database');
        }
        pool = new Pool({ connectionString: process.env.LITELLM_DATABASE_URL });
        shouldClosePool = true;
      }

      if (!pool) {
        throw this.createValidationError('Database pool not available', 'database');
      }

      // Execute restore in transaction, streaming SQL from the gzip file
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await this.streamRestoreSQL(backupPath, client);

        await client.query('COMMIT');

        // Count rows restored
        let rowsRestored = 0;
        for (const [_table, count] of Object.entries(metadata.rowCounts)) {
          rowsRestored += count;
        }

        const duration = Date.now() - startTime;

        this.fastify.log.info({ id, dbType, duration }, 'Backup restored successfully');

        return {
          success: true,
          tablesRestored: metadata.tableCount,
          rowsRestored,
          duration,
          warnings,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
        if (shouldClosePool && pool) {
          await pool.end();
        }
      }
    } catch (error) {
      this.fastify.log.error({ error, id, dbType }, 'Failed to restore backup');
      throw this.mapDatabaseError(error as Error, 'restoring backup');
    }
  }

  /**
   * Test restore - restore to a temporary schema for validation
   */
  async testRestore(
    id: string,
    dbType: BackupDatabaseType,
    testSchemaName?: string,
  ): Promise<TestRestoreResult> {
    const backupPath = this.getBackupPath(id);
    const metaPath = `${backupPath}.meta.json`;

    const startTime = Date.now();
    const warnings: string[] = [];
    const testSchema = this.sanitizeSchemaName(
      testSchemaName ||
        `backup_test_${new Date()
          .toISOString()
          .replace(/[-:]/g, '_')
          .replace(/\.\d+Z$/, '')}`,
    );

    try {
      // Read metadata
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const metadata: BackupMetadata = JSON.parse(metaContent);

      // Get database pool
      let pool: Pool | undefined;
      let shouldClosePool = false;

      if (dbType === 'litemaas') {
        pool = this.fastify.pg.pool;
      } else {
        const capabilities = await this.getCapabilities();
        if (!capabilities.litellmAvailable) {
          throw this.createValidationError('LiteLLM database is not available', 'database');
        }
        pool = new Pool({ connectionString: process.env.LITELLM_DATABASE_URL });
        shouldClosePool = true;
      }

      if (!pool) {
        throw this.createValidationError('Database pool not available', 'database');
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Create test schema
        await client.query(`CREATE SCHEMA ${testSchema}`);

        // Get tables from metadata
        const tables = Object.keys(metadata.rowCounts);

        // Copy table structures to test schema (without FK constraints to avoid cross-schema references)
        for (const table of tables) {
          const quotedTable = this.quoteIdentifier(table);
          await client.query(
            `CREATE TABLE ${testSchema}.${quotedTable} (LIKE public.${quotedTable} INCLUDING DEFAULTS INCLUDING INDEXES)`,
          );
        }

        // Stream restore into the test schema
        await this.streamRestoreSQL(backupPath, client, testSchema);

        await client.query('COMMIT');

        // Verify row counts
        let rowsRestored = 0;
        for (const [table, expectedCount] of Object.entries(metadata.rowCounts)) {
          const result = await client.query(
            `SELECT COUNT(*) as count FROM ${testSchema}.${this.quoteIdentifier(table)}`,
          );
          const actualCount = parseInt(result.rows[0].count, 10);
          rowsRestored += actualCount;

          if (actualCount !== expectedCount) {
            warnings.push(
              `Table ${table}: expected ${expectedCount} rows, got ${actualCount} rows`,
            );
          }
        }

        const duration = Date.now() - startTime;

        this.fastify.log.info(
          { id, dbType, testSchema, duration },
          'Test restore completed successfully',
        );

        return {
          success: true,
          tablesRestored: metadata.tableCount,
          rowsRestored,
          duration,
          warnings,
          testSchema,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
        if (shouldClosePool && pool) {
          await pool.end();
        }
      }
    } catch (error) {
      this.fastify.log.error({ error, id, dbType }, 'Test restore failed');
      throw this.mapDatabaseError(error as Error, 'testing restore');
    }
  }

  /**
   * Quote a SQL identifier (table or column name) to handle mixed-case names.
   * PostgreSQL lowercases unquoted identifiers, so tables created with quotes
   * (e.g., LiteLLM's "LiteLLM_AgentsTable") must always be quoted.
   */
  private quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  /**
   * Get table list for backup
   */
  private async getTableList(pool: Pool, dbType: BackupDatabaseType): Promise<string[]> {
    if (dbType === 'litemaas') {
      return this.LITEMAAS_TABLES;
    } else {
      // For LiteLLM, discover tables dynamically
      const result = await pool.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `);
      return result.rows.map((row) => row.tablename);
    }
  }

  // PostgreSQL OIDs for type-aware serialization
  private readonly PG_JSON_OID = 114;
  private readonly PG_JSONB_OID = 3802;
  private readonly PG_TIMESTAMP_OID = 1114;
  private readonly PG_TIMESTAMPTZ_OID = 1184;

  /**
   * Number of rows to fetch per cursor batch during backup.
   * Balances memory usage vs. number of database round-trips.
   */
  private readonly CURSOR_BATCH_SIZE = 1000;

  /**
   * Stream backup SQL directly to a gzip-compressed file using database cursors.
   * This avoids loading entire tables into memory, preventing OOM on large databases.
   * Returns row counts per table for metadata.
   */
  private async streamBackupSQL(
    pool: Pool,
    tables: string[],
    dbType: BackupDatabaseType,
    backupPath: string,
    timestamp: string,
  ): Promise<Record<string, number>> {
    const rowCounts: Record<string, number> = {};

    // Set up streaming gzip writer
    const gzip = zlib.createGzip();
    const fileStream = createWriteStream(backupPath);
    gzip.pipe(fileStream);

    // Helper to write to gzip stream with backpressure handling
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

    // Use a single client with a transaction for cursor support
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Count total rows across all tables for accurate progress tracking
      if (this.jobStatus.progress) {
        this.jobStatus.progress.tablesTotal = tables.length;
        let totalRows = 0;
        for (const table of tables) {
          const countResult = await client.query(
            `SELECT COUNT(*) as count FROM ${this.quoteIdentifier(table)}`,
          );
          totalRows += parseInt(countResult.rows[0].count, 10);
        }
        this.jobStatus.progress.rowsTotal = totalRows;
      }

      await write(`-- Database backup for ${dbType}\n`);
      await write(`-- Generated at ${timestamp}\n\n`);

      for (const table of tables) {
        // Update progress with current table
        if (this.jobStatus.progress) {
          this.jobStatus.progress.currentTable = table;
        }

        await this.streamTableBackup(client, table, write, rowCounts);

        // Update progress after each table
        if (this.jobStatus.progress) {
          this.jobStatus.progress.tablesCompleted += 1;
          this.jobStatus.progress.rowsProcessed += rowCounts[table] || 0;
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Finalize gzip stream and wait for file write to complete
    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
      gzip.on('error', reject);
      gzip.end();
    });

    return rowCounts;
  }

  /**
   * Stream a single table's backup data using a cursor.
   */
  private async streamTableBackup(
    client: PoolClient,
    table: string,
    write: (data: string) => Promise<void>,
    rowCounts: Record<string, number>,
  ): Promise<void> {
    const quotedTable = this.quoteIdentifier(table);
    await write(`-- Table: ${table}\n`);
    await write(`TRUNCATE TABLE ${quotedTable} CASCADE;\n`);

    // Get column metadata to identify types
    const metaResult = await client.query(`SELECT * FROM ${quotedTable} LIMIT 0`);
    const fields = metaResult.fields;

    if (fields.length === 0) {
      rowCounts[table] = 0;
      await write('\n');
      return;
    }

    const columns = fields.map((f) => f.name);
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c)).join(', ');

    // Build sets of columns by type for proper serialization
    const jsonColumns = new Set(
      fields
        .filter((f) => f.dataTypeID === this.PG_JSON_OID || f.dataTypeID === this.PG_JSONB_OID)
        .map((f) => f.name),
    );
    const timestampColumns = new Set(
      fields
        .filter(
          (f) => f.dataTypeID === this.PG_TIMESTAMP_OID || f.dataTypeID === this.PG_TIMESTAMPTZ_OID,
        )
        .map((f) => f.name),
    );

    // Cast timestamp columns to text to preserve exact precision and timezone
    const selectColumns = fields
      .map((f) => {
        if (f.dataTypeID === this.PG_TIMESTAMP_OID || f.dataTypeID === this.PG_TIMESTAMPTZ_OID) {
          return `${this.quoteIdentifier(f.name)}::text AS ${this.quoteIdentifier(f.name)}`;
        }
        return this.quoteIdentifier(f.name);
      })
      .join(', ');

    // Use a cursor to fetch rows in batches
    const cursorName = `backup_${table.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    await client.query(
      `DECLARE ${this.quoteIdentifier(cursorName)} CURSOR FOR SELECT ${selectColumns} FROM ${quotedTable}`,
    );

    let totalRows = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const batch = await client.query(
          `FETCH ${this.CURSOR_BATCH_SIZE} FROM ${this.quoteIdentifier(cursorName)}`,
        );
        if (batch.rows.length === 0) {
          hasMore = false;
          break;
        }

        totalRows += batch.rows.length;

        for (const row of batch.rows) {
          const values = columns.map((col) =>
            this.escapeSQLValue(row[col], jsonColumns.has(col), timestampColumns.has(col)),
          );
          await write(
            `INSERT INTO ${quotedTable} (${quotedColumns}) VALUES (${values.join(', ')});\n`,
          );
        }
      }
    } finally {
      await client.query(`CLOSE ${this.quoteIdentifier(cursorName)}`);
    }

    rowCounts[table] = totalRows;
    await write('\n');
  }

  /**
   * Escape SQL value for safe insertion.
   * @param isJsonColumn - true if the column is JSON/JSONB type (arrays should stay as JSON, not PG array syntax)
   * @param isTimestamp - true if the column is a timestamp type (value arrives as pre-formatted text string)
   */
  private escapeSQLValue(value: any, isJsonColumn = false, isTimestamp = false): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    // Timestamp columns are cast to text in the SELECT query, so they arrive as exact strings
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
        // JSON/JSONB column: serialize as JSON array
        return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      }
      // PostgreSQL array column (TEXT[], etc.): use PG array literal syntax
      const elements = value.map((v) => {
        if (v === null || v === undefined) return 'NULL';
        const escaped = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      return `'{${elements.join(',')}}'`;
    }

    if (typeof value === 'object') {
      // Handle JSON/JSONB columns (objects are always serialized as JSON)
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }

    // String values - escape single quotes
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  /**
   * Modify SQL to use a specific schema
   */
  /**
   * Stream-decompress a backup file and execute SQL statements in batches.
   * Avoids loading the entire decompressed SQL into memory.
   * Optionally rewrites table references to a different schema (for test restore).
   */
  private async streamRestoreSQL(
    backupPath: string,
    client: PoolClient,
    schema?: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const gunzip = zlib.createGunzip();
      const readStream = createReadStream(backupPath);
      let buffer = '';

      gunzip.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8');

        // Process complete statements (lines ending with ;)
        const lastNewline = buffer.lastIndexOf('\n');
        if (lastNewline === -1) return;

        const processable = buffer.substring(0, lastNewline);
        buffer = buffer.substring(lastNewline + 1);

        const statements = processable
          .split('\n')
          .filter((line) => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !trimmed.startsWith('--');
          })
          .map((line) => {
            if (!schema) return line;
            // Rewrite table references to the target schema
            if (line.startsWith('TRUNCATE TABLE ')) {
              return line.replace('TRUNCATE TABLE ', `TRUNCATE TABLE ${schema}.`);
            }
            if (line.startsWith('INSERT INTO ')) {
              return line.replace('INSERT INTO ', `INSERT INTO ${schema}.`);
            }
            return line;
          });

        if (statements.length > 0) {
          // Pause the stream while we execute, to avoid unbounded buffering
          gunzip.pause();
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
        // Process any remaining buffer
        const remaining = buffer
          .split('\n')
          .filter((line) => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !trimmed.startsWith('--');
          })
          .map((line) => {
            if (!schema) return line;
            if (line.startsWith('TRUNCATE TABLE ')) {
              return line.replace('TRUNCATE TABLE ', `TRUNCATE TABLE ${schema}.`);
            }
            if (line.startsWith('INSERT INTO ')) {
              return line.replace('INSERT INTO ', `INSERT INTO ${schema}.`);
            }
            return line;
          });

        if (remaining.length > 0) {
          client
            .query(remaining.join('\n'))
            .then(() => resolve())
            .catch(reject);
        } else {
          resolve();
        }
      });

      gunzip.on('error', reject);
      readStream.on('error', reject);

      readStream.pipe(gunzip);
    });
  }

  /**
   * Synchronous version of getCapabilities (for path operations)
   */
  private getCapabilitiesSync(): { storagePath: string } {
    return {
      storagePath: process.env.BACKUP_STORAGE_PATH || this.DEFAULT_STORAGE_PATH,
    };
  }

  /**
   * Sanitize schema name to prevent SQL injection
   */
  private sanitizeSchemaName(name: string): string {
    // Only allow alphanumeric characters and underscores
    const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');
    if (sanitized.length === 0 || sanitized.length > 63) {
      throw this.createValidationError(
        'Schema name must be 1-63 characters, alphanumeric and underscores only',
        'testSchemaName',
        name,
      );
    }
    return sanitized;
  }
}
