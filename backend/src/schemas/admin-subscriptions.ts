import { Type } from '@sinclair/typebox';
import { TimestampSchema, PaginationResponseSchema } from './common';
import { SubscriptionStatusEnum } from './subscriptions';

/**
 * Subscription approval filters for admin panel queries
 */
export const SubscriptionApprovalFiltersSchema = Type.Object({
  statuses: Type.Optional(Type.Array(SubscriptionStatusEnum)),
  modelIds: Type.Optional(Type.Array(Type.String())),
  userIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  dateFrom: Type.Optional(TimestampSchema),
  dateTo: Type.Optional(TimestampSchema),
});

/**
 * Bulk approve subscriptions request
 */
export const ApproveSubscriptionsSchema = Type.Object({
  subscriptionIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1 }),
  reason: Type.Optional(Type.String()),
});

/**
 * Bulk deny subscriptions request
 */
export const DenySubscriptionsSchema = Type.Object({
  subscriptionIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1 }),
  reason: Type.String({ minLength: 1 }),
});

/**
 * Revert subscription status request
 */
export const RevertSubscriptionSchema = Type.Object({
  newStatus: Type.Union([Type.Literal('active'), Type.Literal('denied'), Type.Literal('pending')]),
  reason: Type.Optional(Type.String()),
});

/**
 * Subscription status history entry
 */
export const SubscriptionStatusHistoryEntrySchema = Type.Object({
  id: Type.String(),
  oldStatus: Type.Optional(Type.String()),
  newStatus: Type.String(),
  reason: Type.Optional(Type.String()),
  changedBy: Type.Optional(
    Type.Object({
      id: Type.String(),
      username: Type.String(),
    }),
  ),
  changedAt: TimestampSchema,
});

/**
 * Subscription with detailed user and model information
 */
export const SubscriptionWithDetailsSchema = Type.Object({
  id: Type.String(),
  userId: Type.String(),
  modelId: Type.String(),
  status: SubscriptionStatusEnum,
  statusReason: Type.Optional(Type.String()),
  statusChangedAt: Type.Optional(TimestampSchema),
  statusChangedBy: Type.Optional(Type.String()),
  user: Type.Object({
    id: Type.String(),
    username: Type.String(),
    email: Type.String(),
  }),
  model: Type.Object({
    id: Type.String(),
    name: Type.String(),
    provider: Type.String(),
    restrictedAccess: Type.Boolean(),
  }),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  history: Type.Optional(Type.Array(SubscriptionStatusHistoryEntrySchema)),
});

/**
 * Subscription approval statistics
 */
export const SubscriptionApprovalStatsSchema = Type.Object({
  pendingCount: Type.Integer(),
  approvedToday: Type.Integer(),
  deniedToday: Type.Integer(),
  totalRequests: Type.Integer(),
});

/**
 * Bulk operation result
 */
export const BulkOperationResultSchema = Type.Object({
  successful: Type.Integer(),
  failed: Type.Integer(),
  errors: Type.Array(
    Type.Object({
      subscription: Type.String(),
      error: Type.String(),
    }),
  ),
});

/**
 * Paginated subscription requests response
 */
export const SubscriptionRequestsResponseSchema = Type.Object({
  data: Type.Array(SubscriptionWithDetailsSchema),
  pagination: PaginationResponseSchema,
});

/**
 * URL parameter schemas
 */
export const SubscriptionIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

/**
 * Query parameter schemas for list endpoint
 */
export const SubscriptionApprovalQuerySchema = Type.Object({
  statuses: Type.Optional(Type.Array(Type.String())),
  modelIds: Type.Optional(Type.Array(Type.String())),
  userIds: Type.Optional(Type.Array(Type.String())),
  dateFrom: Type.Optional(Type.String({ format: 'date-time' })),
  dateTo: Type.Optional(Type.String({ format: 'date-time' })),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
