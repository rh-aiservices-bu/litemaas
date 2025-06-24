import { Type } from '@sinclair/typebox';
import { PaginationSchema, TimestampSchema, createPaginatedResponse } from './common';

export const SubscriptionQuotaSchema = Type.Object({
  requests: Type.Integer({ minimum: 1 }),
  tokens: Type.Integer({ minimum: 1 }),
});

export const SubscriptionUsageSchema = Type.Object({
  requests: Type.Integer({ minimum: 0 }),
  tokens: Type.Integer({ minimum: 0 }),
});

export const SubscriptionStatusEnum = Type.Union([
  Type.Literal('pending'),
  Type.Literal('active'),
  Type.Literal('suspended'),
  Type.Literal('cancelled'),
  Type.Literal('expired'),
]);

export const SubscriptionSchema = Type.Object({
  id: Type.String(),
  userId: Type.String(),
  modelId: Type.String(),
  status: SubscriptionStatusEnum,
  quotaRequests: Type.Integer(),
  quotaTokens: Type.Integer(),
  usedRequests: Type.Integer(),
  usedTokens: Type.Integer(),
  resetAt: Type.Optional(TimestampSchema),
  expiresAt: Type.Optional(TimestampSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const SubscriptionDetailsSchema = Type.Composite([
  SubscriptionSchema,
  Type.Object({
    user: Type.Optional(Type.Object({
      username: Type.String(),
      email: Type.String(),
    })),
    model: Type.Optional(Type.Object({
      name: Type.String(),
      provider: Type.String(),
    })),
    remainingRequests: Type.Integer(),
    remainingTokens: Type.Integer(),
  }),
]);

export const SubscriptionWithApiKeySchema = Type.Composite([
  SubscriptionDetailsSchema,
  Type.Object({
    apiKey: Type.Object({
      id: Type.String(),
      key: Type.String(),
      createdAt: TimestampSchema,
    }),
  }),
]);

export const CreateSubscriptionSchema = Type.Object({
  modelId: Type.String(),
  quota: SubscriptionQuotaSchema,
  expiresAt: Type.Optional(TimestampSchema),
});

export const UpdateSubscriptionSchema = Type.Object({
  quota: Type.Optional(Type.Partial(SubscriptionQuotaSchema)),
  status: Type.Optional(Type.Union([
    Type.Literal('active'),
    Type.Literal('suspended'),
    Type.Literal('cancelled'),
  ])),
  expiresAt: Type.Optional(TimestampSchema),
});

export const SubscriptionListQuerySchema = Type.Composite([
  PaginationSchema,
  Type.Object({
    status: Type.Optional(SubscriptionStatusEnum),
    modelId: Type.Optional(Type.String()),
  }),
]);

export const SubscriptionListResponseSchema = createPaginatedResponse(SubscriptionDetailsSchema);