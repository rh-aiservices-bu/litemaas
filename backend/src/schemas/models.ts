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
  restrictedAccess: Type.Optional(Type.Boolean()),
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
  restrictedAccess: Type.Optional(Type.Boolean()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

export const UpdateModelSchema = Type.Object({
  name: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  capabilities: Type.Optional(Type.Array(Type.String())),
  contextLength: Type.Optional(Type.Integer({ minimum: 1 })),
  pricing: Type.Optional(ModelPricingSchema),
  restrictedAccess: Type.Optional(Type.Boolean()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
  isActive: Type.Optional(Type.Boolean()),
});
/**
 * LiteLLM-specific model schemas
 */
export const LiteLLMModelSchema = Type.Object({
  id: Type.String(),
  object: Type.String(),
  created: Type.Number(),
  owned_by: Type.String(),
  litellm_provider: Type.Optional(Type.String()),
  source: Type.Optional(Type.String()),
  max_tokens: Type.Optional(Type.Number()),
  supports_function_calling: Type.Optional(Type.Boolean()),
  supports_parallel_function_calling: Type.Optional(Type.Boolean()),
  supports_vision: Type.Optional(Type.Boolean()),
  supports_assistant_api: Type.Optional(Type.Boolean()),
  input_cost_per_token: Type.Optional(Type.Number()),
  output_cost_per_token: Type.Optional(Type.Number()),
});

export const LiteLLMModelListResponseSchema = Type.Object({
  object: Type.Literal('list'),
  data: Type.Array(LiteLLMModelSchema),
});

export const EnhancedModelSchema = Type.Intersect([
  ModelSchema,
  Type.Object({
    liteLLMInfo: Type.Optional(
      Type.Object({
        id: Type.String(),
        object: Type.String(),
        created: Type.Number(),
        owned_by: Type.String(),
        litellm_provider: Type.Optional(Type.String()),
        source: Type.Optional(Type.String()),
        supports_function_calling: Type.Optional(Type.Boolean()),
        supports_parallel_function_calling: Type.Optional(Type.Boolean()),
        supports_vision: Type.Optional(Type.Boolean()),
        supports_assistant_api: Type.Optional(Type.Boolean()),
      }),
    ),
    lastSyncAt: Type.Optional(TimestampSchema),
    syncStatus: Type.Optional(
      Type.Union([Type.Literal('synced'), Type.Literal('pending'), Type.Literal('error')]),
    ),
    syncError: Type.Optional(Type.String()),
  }),
]);

export const ModelSyncRequestSchema = Type.Object({
  forceSync: Type.Optional(Type.Boolean()),
  provider: Type.Optional(Type.String()),
  includeInactive: Type.Optional(Type.Boolean()),
});

export const ModelSyncResponseSchema = Type.Object({
  syncedCount: Type.Number(),
  errorCount: Type.Number(),
  errors: Type.Optional(
    Type.Array(
      Type.Object({
        modelId: Type.String(),
        error: Type.String(),
      }),
    ),
  ),
  lastSyncAt: TimestampSchema,
});
