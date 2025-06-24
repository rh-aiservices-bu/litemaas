import { Type } from '@sinclair/typebox';
import { PaginationSchema, TimestampSchema, createPaginatedResponse } from './common';

export const ModelPricingSchema = Type.Object({
  input: Type.Number({ minimum: 0 }),
  output: Type.Number({ minimum: 0 }),
  unit: Type.Union([
    Type.Literal('per_1k_tokens'),
    Type.Literal('per_request'),
    Type.Literal('per_minute'),
  ]),
});

export const ModelSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  provider: Type.String(),
  description: Type.Optional(Type.String()),
  capabilities: Type.Array(Type.String()),
  contextLength: Type.Optional(Type.Integer({ minimum: 1 })),
  pricing: Type.Optional(ModelPricingSchema),
  isActive: Type.Boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const ModelDetailsSchema = Type.Composite([
  ModelSchema,
  Type.Object({
    metadata: Type.Record(Type.String(), Type.Any()),
  }),
]);

export const ModelListQuerySchema = Type.Composite([
  PaginationSchema,
  Type.Object({
    search: Type.Optional(Type.String()),
    provider: Type.Optional(Type.String()),
    capability: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.Boolean()),
  }),
]);

export const ModelListResponseSchema = createPaginatedResponse(ModelSchema);

export const CreateModelSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  provider: Type.String(),
  description: Type.Optional(Type.String()),
  capabilities: Type.Optional(Type.Array(Type.String())),
  contextLength: Type.Optional(Type.Integer({ minimum: 1 })),
  pricing: Type.Optional(ModelPricingSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

export const UpdateModelSchema = Type.Object({
  name: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  capabilities: Type.Optional(Type.Array(Type.String())),
  contextLength: Type.Optional(Type.Integer({ minimum: 1 })),
  pricing: Type.Optional(ModelPricingSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
  isActive: Type.Optional(Type.Boolean()),
});