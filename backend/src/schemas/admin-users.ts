import { Type, Static } from '@sinclair/typebox';
import { PaginationSchema, createPaginatedResponse } from './common';

// User ID parameter
export const UserIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export type UserIdParam = Static<typeof UserIdParamSchema>;

// API Key ID parameter (for nested routes)
export const UserApiKeyIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  keyId: Type.String({ format: 'uuid' }),
});

export type UserApiKeyIdParam = Static<typeof UserApiKeyIdParamSchema>;

// Admin User Details Response
export const AdminUserDetailsSchema = Type.Object({
  id: Type.String(),
  username: Type.String(),
  email: Type.String(),
  fullName: Type.Optional(Type.String()),
  roles: Type.Array(Type.String()),
  isActive: Type.Boolean(),
  maxBudget: Type.Optional(Type.Number()),
  currentSpend: Type.Optional(Type.Number()),
  tpmLimit: Type.Optional(Type.Integer()),
  rpmLimit: Type.Optional(Type.Integer()),
  syncStatus: Type.Optional(Type.String()),
  lastLoginAt: Type.Optional(Type.String({ format: 'date-time' })),
  createdAt: Type.String({ format: 'date-time' }),
  subscriptionsCount: Type.Integer(),
  activeSubscriptionsCount: Type.Integer(),
  apiKeysCount: Type.Integer(),
  activeApiKeysCount: Type.Integer(),
});

export type AdminUserDetails = Static<typeof AdminUserDetailsSchema>;

// Update Budget and Limits
export const UpdateUserBudgetLimitsSchema = Type.Object({
  maxBudget: Type.Optional(Type.Number({ minimum: 0 })),
  tpmLimit: Type.Optional(Type.Integer({ minimum: 0 })),
  rpmLimit: Type.Optional(Type.Integer({ minimum: 0 })),
});

export type UpdateUserBudgetLimits = Static<typeof UpdateUserBudgetLimitsSchema>;

// User API Key Schema (for listing)
export const UserApiKeySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  keyPrefix: Type.String(),
  models: Type.Array(Type.String()),
  modelDetails: Type.Optional(
    Type.Array(
      Type.Object({
        id: Type.String(),
        name: Type.String(),
        provider: Type.Optional(Type.String()),
      }),
    ),
  ),
  isActive: Type.Boolean(),
  maxBudget: Type.Optional(Type.Number()),
  currentSpend: Type.Optional(Type.Number()),
  tpmLimit: Type.Optional(Type.Integer()),
  rpmLimit: Type.Optional(Type.Integer()),
  budgetDuration: Type.Optional(Type.String()),
  softBudget: Type.Optional(Type.Number()),
  budgetUtilization: Type.Optional(Type.Number()),
  maxParallelRequests: Type.Optional(Type.Integer()),
  modelMaxBudget: Type.Optional(Type.Any()),
  modelRpmLimit: Type.Optional(Type.Any()),
  modelTpmLimit: Type.Optional(Type.Any()),
  lastUsedAt: Type.Optional(Type.String({ format: 'date-time' })),
  createdAt: Type.String({ format: 'date-time' }),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
  revokedAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export type UserApiKey = Static<typeof UserApiKeySchema>;

export const UserApiKeysResponseSchema = createPaginatedResponse(UserApiKeySchema);

// Create API Key for User
export const CreateApiKeyForUserSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  modelIds: Type.Array(Type.String(), { minItems: 1 }),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
  maxBudget: Type.Optional(Type.Number({ minimum: 0 })),
  tpmLimit: Type.Optional(Type.Integer({ minimum: 0 })),
  rpmLimit: Type.Optional(Type.Integer({ minimum: 0 })),
  maxParallelRequests: Type.Optional(Type.Integer({ minimum: 1 })),
  budgetDuration: Type.Optional(
    Type.Union([
      Type.Literal('daily'),
      Type.Literal('weekly'),
      Type.Literal('monthly'),
      Type.Literal('yearly'),
      Type.String({ pattern: '^\\d+[smhd]$|^\\d+mo$' }),
    ]),
  ),
  softBudget: Type.Optional(Type.Number({ minimum: 0 })),
  modelMaxBudget: Type.Optional(
    Type.Record(
      Type.String(),
      Type.Object({
        budgetLimit: Type.Number({ minimum: 0 }),
        timePeriod: Type.String(),
      }),
    ),
  ),
  modelRpmLimit: Type.Optional(Type.Record(Type.String(), Type.Integer({ minimum: 0 }))),
  modelTpmLimit: Type.Optional(Type.Record(Type.String(), Type.Integer({ minimum: 0 }))),
});

export type CreateApiKeyForUser = Static<typeof CreateApiKeyForUserSchema>;

// Created API Key Response (includes the full key - shown only once)
export const CreatedApiKeySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  key: Type.String(), // Full key - only shown once
  keyPrefix: Type.String(),
  models: Type.Array(Type.String()),
  isActive: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export type CreatedApiKey = Static<typeof CreatedApiKeySchema>;

// Update API Key Models
export const UpdateApiKeyModelsSchema = Type.Object({
  modelIds: Type.Array(Type.String()),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
});

export type UpdateApiKeyModels = Static<typeof UpdateApiKeyModelsSchema>;

// Revoke API Key (optional reason)
export const RevokeApiKeySchema = Type.Object({
  reason: Type.Optional(Type.String({ maxLength: 500 })),
});

export type RevokeApiKey = Static<typeof RevokeApiKeySchema>;

// User Subscription Schema (for listing)
export const UserSubscriptionSchema = Type.Object({
  id: Type.String(),
  modelId: Type.String(),
  modelName: Type.String(),
  provider: Type.Optional(Type.String()),
  status: Type.String(),
  statusReason: Type.Optional(Type.String()),
  createdAt: Type.String({ format: 'date-time' }),
  statusChangedAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export type UserSubscription = Static<typeof UserSubscriptionSchema>;

export const UserSubscriptionsResponseSchema = createPaginatedResponse(UserSubscriptionSchema);

// Query schema for list endpoints
export const AdminUserApiKeysQuerySchema = Type.Intersect([
  PaginationSchema,
  Type.Object({
    isActive: Type.Optional(Type.Boolean()),
  }),
]);

export const AdminUserSubscriptionsQuerySchema = Type.Intersect([
  PaginationSchema,
  Type.Object({
    status: Type.Optional(Type.String()),
  }),
]);

// Response for budget update
export const UserBudgetUpdatedSchema = Type.Object({
  id: Type.String(),
  maxBudget: Type.Optional(Type.Number()),
  tpmLimit: Type.Optional(Type.Integer()),
  rpmLimit: Type.Optional(Type.Integer()),
  updatedAt: Type.String({ format: 'date-time' }),
});

export type UserBudgetUpdated = Static<typeof UserBudgetUpdatedSchema>;
