import { Type, Static } from '@sinclair/typebox';

// Bulk update user limits request schema
export const BulkUpdateUserLimitsSchema = Type.Object({
  maxBudget: Type.Optional(
    Type.Number({
      minimum: 0,
      description: 'Maximum budget in dollars',
    }),
  ),
  tpmLimit: Type.Optional(
    Type.Integer({
      minimum: 0,
      description: 'Tokens per minute limit',
    }),
  ),
  rpmLimit: Type.Optional(
    Type.Integer({
      minimum: 0,
      description: 'Requests per minute limit',
    }),
  ),
});

// Bulk update user limits response schema
export const BulkUpdateUserLimitsResponseSchema = Type.Object({
  totalUsers: Type.Integer({
    minimum: 0,
    description: 'Total number of users processed',
  }),
  successCount: Type.Integer({
    minimum: 0,
    description: 'Number of users successfully updated',
  }),
  failedCount: Type.Integer({
    minimum: 0,
    description: 'Number of users that failed to update',
  }),
  errors: Type.Array(
    Type.Object({
      userId: Type.String({ description: 'User ID that failed' }),
      username: Type.String({ description: 'Username that failed' }),
      error: Type.String({ description: 'Error message' }),
    }),
    { description: 'List of errors encountered' },
  ),
  processedAt: Type.String({
    format: 'date-time',
    description: 'Timestamp when the operation was processed',
  }),
});

// System stats response schema
export const SystemStatsResponseSchema = Type.Object({
  totalUsers: Type.Integer({ minimum: 0 }),
  activeUsers: Type.Integer({ minimum: 0 }),
  totalApiKeys: Type.Integer({ minimum: 0 }),
  activeApiKeys: Type.Integer({ minimum: 0 }),
  totalModels: Type.Integer({ minimum: 0 }),
  availableModels: Type.Integer({ minimum: 0 }),
});

// Error response schema
export const AdminErrorResponseSchema = Type.Object({
  error: Type.String({ description: 'Error message' }),
  code: Type.Optional(Type.String({ description: 'Error code' })),
  details: Type.Optional(Type.Object({}, { additionalProperties: true })),
});

// Type exports
export type BulkUpdateUserLimitsRequest = Static<typeof BulkUpdateUserLimitsSchema>;
export type BulkUpdateUserLimitsResponse = Static<typeof BulkUpdateUserLimitsResponseSchema>;
export type SystemStatsResponse = Static<typeof SystemStatsResponseSchema>;
export type AdminErrorResponse = Static<typeof AdminErrorResponseSchema>;
