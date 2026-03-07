import { FastifyPluginAsync } from 'fastify';
import { createReadStream } from 'fs';
import { ApplicationError } from '../utils/errors';
import { BackupService } from '../services/backup.service';
import { BackupDatabaseType } from '../types/backup.types';
import { AuthenticatedRequest } from '../types';

const adminBackupRoutes: FastifyPluginAsync = async (fastify) => {
  const backupService = new BackupService(fastify);

  /**
   * Helper to log audit trail for backup operations
   */
  const logAudit = async (
    userId: string,
    action: string,
    resourceId: string,
    success: boolean,
    metadata?: any,
    errorMessage?: string,
  ) => {
    try {
      await fastify.pg.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, success, error_message, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [userId, action, 'backup', resourceId, success, errorMessage || null, metadata || null],
      );
    } catch (error) {
      fastify.log.error({ error }, 'Failed to log audit trail');
    }
  };

  // Get backup capabilities
  fastify.get(
    '/capabilities',
    {
      schema: {
        tags: ['Admin - Backup'],
        summary: 'Get backup capabilities',
        description: 'Check which databases are available for backup and restore operations',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:backup')],
    },
    async (_request, _reply) => {
      try {
        const capabilities = await backupService.getCapabilities();
        return { data: capabilities };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get backup capabilities');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to get backup capabilities: ${errorMessage}`);
      }
    },
  );

  // Create a new backup
  fastify.post<{
    Body: { database: BackupDatabaseType };
  }>(
    '/create',
    {
      schema: {
        tags: ['Admin - Backup'],
        summary: 'Create a database backup',
        description: 'Create a compressed backup of the specified database',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['database'],
          properties: {
            database: {
              type: 'string',
              enum: ['litemaas', 'litellm'],
              description: 'Database to backup',
            },
          },
        },
      },
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:backup')],
    },
    async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { database } = request.body as { database: BackupDatabaseType };

      try {
        const backupInfo = await backupService.createBackup(database);

        await logAudit(user.userId, 'backup:create', backupInfo.id, true, {
          database,
          filename: backupInfo.filename,
          size: backupInfo.size,
          tableCount: backupInfo.metadata.tableCount,
        });

        return { data: backupInfo };
      } catch (error) {
        await logAudit(
          user.userId,
          'backup:create',
          database,
          false,
          { database },
          error instanceof Error ? error.message : String(error),
        );

        fastify.log.error({ error, database }, 'Failed to create backup');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to create backup: ${errorMessage}`);
      }
    },
  );

  // List all backups
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Admin - Backup'],
        summary: 'List all backups',
        description: 'Retrieve a list of all available database backups',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:backup')],
    },
    async (_request, _reply) => {
      try {
        const backups = await backupService.listBackups();
        return { data: backups };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list backups');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to list backups: ${errorMessage}`);
      }
    },
  );

  // Get backup info by ID
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id',
    {
      schema: {
        tags: ['Admin - Backup'],
        summary: 'Get backup information',
        description: 'Retrieve detailed information about a specific backup',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Backup ID (filename)' },
          },
        },
      },
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:backup')],
    },
    async (request, _reply) => {
      const { id } = request.params;

      try {
        const backups = await backupService.listBackups();
        const backup = backups.find((b) => b.id === id);

        if (!backup) {
          throw fastify.createError(404, 'Backup not found');
        }

        return { data: backup };
      } catch (error) {
        fastify.log.error({ error, id }, 'Failed to get backup info');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to get backup info: ${errorMessage}`);
      }
    },
  );

  // Download a backup
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id/download',
    {
      schema: {
        tags: ['Admin - Backup'],
        summary: 'Download a backup file',
        description: 'Download the compressed backup file',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Backup ID (filename)' },
          },
        },
      },
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:backup')],
    },
    async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params as { id: string };

      try {
        const backupPath = backupService.getBackupPath(id);

        // Set headers for download
        reply.header('Content-Disposition', `attachment; filename="${id}"`);
        reply.type('application/gzip');

        await logAudit(user.userId, 'backup:download', id, true, { filename: id });

        // Stream the file
        return reply.send(createReadStream(backupPath));
      } catch (error) {
        await logAudit(
          user.userId,
          'backup:download',
          id,
          false,
          { filename: id },
          error instanceof Error ? error.message : String(error),
        );

        fastify.log.error({ error, id }, 'Failed to download backup');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to download backup: ${errorMessage}`);
      }
    },
  );

  // Delete a backup
  fastify.delete<{
    Params: { id: string };
  }>(
    '/:id',
    {
      schema: {
        tags: ['Admin - Backup'],
        summary: 'Delete a backup',
        description: 'Permanently delete a backup file and its metadata',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Backup ID (filename)' },
          },
        },
      },
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:backup')],
    },
    async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params as { id: string };

      try {
        await backupService.deleteBackup(id);

        await logAudit(user.userId, 'backup:delete', id, true, { filename: id });

        return { success: true, message: 'Backup deleted successfully' };
      } catch (error) {
        await logAudit(
          user.userId,
          'backup:delete',
          id,
          false,
          { filename: id },
          error instanceof Error ? error.message : String(error),
        );

        fastify.log.error({ error, id }, 'Failed to delete backup');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to delete backup: ${errorMessage}`);
      }
    },
  );

  // Restore a backup
  fastify.post<{
    Params: { id: string };
    Body: { database: BackupDatabaseType };
  }>(
    '/:id/restore',
    {
      schema: {
        tags: ['Admin - Backup'],
        summary: 'Restore a backup',
        description: 'Restore a backup to the specified database (DESTRUCTIVE OPERATION)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Backup ID (filename)' },
          },
        },
        body: {
          type: 'object',
          required: ['database'],
          properties: {
            database: {
              type: 'string',
              enum: ['litemaas', 'litellm'],
              description: 'Target database for restore',
            },
          },
        },
      },
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:backup')],
    },
    async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params as { id: string };
      const { database } = request.body as { database: BackupDatabaseType };

      try {
        const result = await backupService.restoreBackup(id, database);

        await logAudit(user.userId, 'backup:restore', id, true, {
          filename: id,
          database,
          tablesRestored: result.tablesRestored,
          rowsRestored: result.rowsRestored,
          duration: result.duration,
          warnings: result.warnings,
        });

        return { data: result };
      } catch (error) {
        await logAudit(
          user.userId,
          'backup:restore',
          id,
          false,
          { filename: id, database },
          error instanceof Error ? error.message : String(error),
        );

        fastify.log.error({ error, id, database }, 'Failed to restore backup');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to restore backup: ${errorMessage}`);
      }
    },
  );

  // Test restore a backup
  fastify.post<{
    Params: { id: string };
    Body: { database: BackupDatabaseType; testSchemaName?: string };
  }>(
    '/:id/test-restore',
    {
      schema: {
        tags: ['Admin - Backup'],
        summary: 'Test restore a backup',
        description: 'Test restore a backup to a temporary schema for validation',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Backup ID (filename)' },
          },
        },
        body: {
          type: 'object',
          required: ['database'],
          properties: {
            database: {
              type: 'string',
              enum: ['litemaas', 'litellm'],
              description: 'Target database for test restore',
            },
            testSchemaName: {
              type: 'string',
              description: 'Optional custom name for the test schema',
            },
          },
        },
      },
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:backup')],
    },
    async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params as { id: string };
      const { database, testSchemaName } = request.body as {
        database: BackupDatabaseType;
        testSchemaName?: string;
      };

      try {
        const result = await backupService.testRestore(id, database, testSchemaName);

        await logAudit(user.userId, 'backup:test-restore', id, true, {
          filename: id,
          database,
          testSchema: result.testSchema,
          tablesRestored: result.tablesRestored,
          rowsRestored: result.rowsRestored,
          duration: result.duration,
          warnings: result.warnings,
        });

        return { data: result };
      } catch (error) {
        await logAudit(
          user.userId,
          'backup:test-restore',
          id,
          false,
          { filename: id, database },
          error instanceof Error ? error.message : String(error),
        );

        fastify.log.error({ error, id, database }, 'Failed to test restore backup');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to test restore backup: ${errorMessage}`);
      }
    },
  );
};

export default adminBackupRoutes;
