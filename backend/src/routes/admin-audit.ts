import { FastifyPluginAsync } from 'fastify';
import { ApplicationError } from '../utils/errors';

const adminAuditRoutes: FastifyPluginAsync = async (fastify) => {
  // Get audit logs with pagination and filters
  fastify.get('/', {
    schema: {
      tags: ['Admin - Audit'],
      summary: 'Get audit logs',
      description:
        'Retrieve audit logs with optional filtering by action, resource type, user, date range, and search',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:audit')],
    handler: async (request, _reply) => {
      try {
        const {
          page = 1,
          limit = 20,
          action,
          resourceType,
          userId,
          startDate,
          endDate,
          search,
          excludeResourceTypes,
        } = request.query as any;

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const offset = (pageNum - 1) * limitNum;

        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (action) {
          conditions.push(`al.action = $${paramIndex++}`);
          params.push(action);
        }

        if (resourceType) {
          conditions.push(`al.resource_type = $${paramIndex++}`);
          params.push(resourceType);
        }

        if (userId) {
          conditions.push(`al.user_id = $${paramIndex++}`);
          params.push(userId);
        }

        if (startDate) {
          conditions.push(`al.created_at >= $${paramIndex++}`);
          params.push(new Date(startDate));
        }

        if (endDate) {
          conditions.push(`al.created_at <= $${paramIndex++}`);
          params.push(new Date(endDate));
        }

        if (excludeResourceTypes) {
          const types = excludeResourceTypes.split(',').map((t: string) => t.trim());
          const placeholders = types.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`al.resource_type NOT IN (${placeholders})`);
          params.push(...types);
        }

        if (search) {
          conditions.push(
            `(al.action ILIKE $${paramIndex} OR al.resource_id ILIKE $${paramIndex} OR al.metadata::text ILIKE $${paramIndex})`,
          );
          params.push(`%${search}%`);
          paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count query
        const countResult = await fastify.pg.query(
          `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
          params,
        );
        const total = parseInt(countResult.rows[0].total, 10);

        // Data query with user join
        const dataResult = await fastify.pg.query(
          `SELECT
            al.id,
            al.user_id as "userId",
            u.username,
            u.email,
            al.action,
            al.resource_type as "resourceType",
            al.resource_id as "resourceId",
            al.success,
            al.error_message as "errorMessage",
            al.metadata,
            al.ip_address as "ipAddress",
            al.created_at as "createdAt"
          FROM audit_logs al
          LEFT JOIN users u ON al.user_id = u.id
          ${whereClause}
          ORDER BY al.created_at DESC
          LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
          [...params, limitNum, offset],
        );

        // Sanitize sensitive fields from audit log metadata
        const sanitizedRows = dataResult.rows.map((row: any) => {
          if (row.metadata && typeof row.metadata === 'object') {
            const { liteLLMKeyId, ...safeMetadata } = row.metadata;
            return { ...row, metadata: safeMetadata };
          }
          return row;
        });

        return {
          data: sanitizedRows,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get audit logs');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to get audit logs: ${errorMessage}`);
      }
    },
  });

  // Get distinct action types
  fastify.get('/actions', {
    schema: {
      tags: ['Admin - Audit'],
      summary: 'Get distinct audit log action types',
      description: 'Retrieve a list of all distinct action types from audit logs',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:audit')],
    handler: async (request, _reply) => {
      try {
        const { excludeResourceTypes, resourceType } = request.query as any;

        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (excludeResourceTypes) {
          const types = excludeResourceTypes.split(',').map((t: string) => t.trim());
          const placeholders = types.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`resource_type NOT IN (${placeholders})`);
          params.push(...types);
        }

        if (resourceType) {
          conditions.push(`resource_type = $${paramIndex++}`);
          params.push(resourceType);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await fastify.pg.query(
          `SELECT DISTINCT action FROM audit_logs ${whereClause} ORDER BY action`,
          params,
        );

        return {
          actions: result.rows.map((row: any) => row.action),
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get audit log actions');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to get audit log actions: ${errorMessage}`);
      }
    },
  });

  // Get distinct resource types (categories)
  fastify.get('/categories', {
    schema: {
      tags: ['Admin - Audit'],
      summary: 'Get distinct audit log resource types',
      description: 'Retrieve a list of all distinct resource types (categories) from audit logs',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:audit')],
    handler: async (_request, _reply) => {
      try {
        const result = await fastify.pg.query(
          'SELECT DISTINCT resource_type FROM audit_logs ORDER BY resource_type',
        );

        return {
          categories: result.rows.map((row: any) => row.resource_type),
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get audit log categories');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to get audit log categories: ${errorMessage}`);
      }
    },
  });
};

export default adminAuditRoutes;
