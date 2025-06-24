import { Type } from '@sinclair/typebox';
import { PaginationSchema, TimestampSchema, createPaginatedResponse } from './common';

export const ApiKeySchema = Type.Object({
  id: Type.String(),
  subscriptionId: Type.String(),
  name: Type.Optional(Type.String()),
  keyHash: Type.String(),
  keyPrefix: Type.String(),
  lastUsedAt: Type.Optional(TimestampSchema),
  expiresAt: Type.Optional(TimestampSchema),
  isActive: Type.Boolean(),
  createdAt: TimestampSchema,
  revokedAt: Type.Optional(TimestampSchema),
});

export const ApiKeyDetailsSchema = Type.Object({
  id: Type.String(),
  name: Type.Optional(Type.String()),
  prefix: Type.String(),
  subscriptionId: Type.String(),
  lastUsedAt: Type.Optional(TimestampSchema),
  createdAt: TimestampSchema,
});

export const CreateApiKeySchema = Type.Object({
  subscriptionId: Type.String(),
  name: Type.Optional(Type.String()),
  expiresAt: Type.Optional(TimestampSchema),
});

export const CreateApiKeyResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.Optional(Type.String()),
  key: Type.String(),
  subscriptionId: Type.String(),
  createdAt: TimestampSchema,
});

export const RotateApiKeyResponseSchema = Type.Object({
  id: Type.String(),
  key: Type.String(),
  rotatedAt: TimestampSchema,
});

export const ApiKeyListQuerySchema = Type.Composite([
  PaginationSchema,
  Type.Object({
    subscriptionId: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.Boolean()),
  }),
]);

export const ApiKeyListResponseSchema = createPaginatedResponse(ApiKeyDetailsSchema);

export const ApiKeyValidationSchema = Type.Object({
  isValid: Type.Boolean(),
  apiKey: Type.Optional(ApiKeySchema),
  subscription: Type.Optional(Type.Object({
    id: Type.String(),
    userId: Type.String(),
    modelId: Type.String(),
    status: Type.String(),
    remainingRequests: Type.Integer(),
    remainingTokens: Type.Integer(),
  })),
  error: Type.Optional(Type.String()),
});