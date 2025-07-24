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
/**
 * LiteLLM-specific API key schemas
 */
export const LiteLLMKeyGenerationRequestSchema = Type.Object({
  key_alias: Type.Optional(Type.String()),
  duration: Type.Optional(Type.String()),
  models: Type.Optional(Type.Array(Type.String())),
  max_budget: Type.Optional(Type.Number()),
  user_id: Type.Optional(Type.String()),
  team_id: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
  tpm_limit: Type.Optional(Type.Number()),
  rpm_limit: Type.Optional(Type.Number()),
  budget_duration: Type.Optional(Type.String()),
  permissions: Type.Optional(Type.Object({
    allow_chat_completions: Type.Optional(Type.Boolean()),
    allow_embeddings: Type.Optional(Type.Boolean()),
    allow_completions: Type.Optional(Type.Boolean()),
  })),
  guardrails: Type.Optional(Type.Array(Type.String())),
  blocked: Type.Optional(Type.Boolean()),
  tags: Type.Optional(Type.Array(Type.String())),
  allowed_routes: Type.Optional(Type.Array(Type.String())),
  soft_budget: Type.Optional(Type.Number()),
});

export const LiteLLMKeyGenerationResponseSchema = Type.Object({
  key: Type.String(),
  key_name: Type.Optional(Type.String()),
  expires: Type.Optional(Type.String()),
  token_id: Type.Optional(Type.String()),
  user_id: Type.Optional(Type.String()),
  team_id: Type.Optional(Type.String()),
  max_budget: Type.Optional(Type.Number()),
  current_spend: Type.Optional(Type.Number()),
  created_by: Type.Optional(Type.String()),
  created_at: Type.Optional(Type.String()),
});

export const LiteLLMKeyInfoSchema = Type.Object({
  key_name: Type.Optional(Type.String()),
  spend: Type.Number(),
  max_budget: Type.Optional(Type.Number()),
  models: Type.Optional(Type.Array(Type.String())),
  tpm_limit: Type.Optional(Type.Number()),
  rpm_limit: Type.Optional(Type.Number()),
  user_id: Type.Optional(Type.String()),
  team_id: Type.Optional(Type.String()),
  expires: Type.Optional(Type.String()),
  budget_reset_at: Type.Optional(Type.String()),
  soft_budget: Type.Optional(Type.Number()),
  blocked: Type.Optional(Type.Boolean()),
  tags: Type.Optional(Type.Array(Type.String())),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

export const EnhancedApiKeySchema = Type.Intersect([
  ApiKeySchema,
  Type.Object({
    liteLLMKeyId: Type.Optional(Type.String()),
    liteLLMInfo: Type.Optional(Type.Object({
      key_name: Type.Optional(Type.String()),
      max_budget: Type.Optional(Type.Number()),
      current_spend: Type.Optional(Type.Number()),
      tpm_limit: Type.Optional(Type.Number()),
      rpm_limit: Type.Optional(Type.Number()),
      team_id: Type.Optional(Type.String()),
      budget_duration: Type.Optional(Type.String()),
      soft_budget: Type.Optional(Type.Number()),
      blocked: Type.Optional(Type.Boolean()),
      tags: Type.Optional(Type.Array(Type.String())),
      models: Type.Optional(Type.Array(Type.String())),
      spend_reset_at: Type.Optional(TimestampSchema),
    })),
    lastSyncAt: Type.Optional(TimestampSchema),
    syncStatus: Type.Optional(Type.Union([
      Type.Literal('synced'),
      Type.Literal('pending'),
      Type.Literal('error')
    ])),
    syncError: Type.Optional(Type.String()),
  })
]);

export const EnhancedCreateApiKeySchema = Type.Intersect([
  CreateApiKeySchema,
  Type.Object({
    maxBudget: Type.Optional(Type.Number()),
    budgetDuration: Type.Optional(Type.Union([
      Type.Literal('daily'),
      Type.Literal('weekly'),
      Type.Literal('monthly'),
      Type.Literal('yearly')
    ])),
    tpmLimit: Type.Optional(Type.Number()),
    rpmLimit: Type.Optional(Type.Number()),
    allowedModels: Type.Optional(Type.Array(Type.String())),
    teamId: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
    permissions: Type.Optional(Type.Object({
      allowChatCompletions: Type.Optional(Type.Boolean()),
      allowEmbeddings: Type.Optional(Type.Boolean()),
      allowCompletions: Type.Optional(Type.Boolean()),
    })),
    softBudget: Type.Optional(Type.Number()),
    guardrails: Type.Optional(Type.Array(Type.String())),
  })
]);

export const ApiKeySpendInfoSchema = Type.Object({
  keyId: Type.String(),
  currentSpend: Type.Number(),
  maxBudget: Type.Optional(Type.Number()),
  budgetUtilization: Type.Number(),
  remainingBudget: Type.Optional(Type.Number()),
  spendResetAt: Type.Optional(TimestampSchema),
  lastUpdatedAt: TimestampSchema,
});

export const ApiKeyUsageMetricsSchema = Type.Object({
  keyId: Type.String(),
  requestCount: Type.Number(),
  tokenCount: Type.Number(),
  errorCount: Type.Number(),
  lastRequestAt: Type.Optional(TimestampSchema),
  averageResponseTime: Type.Optional(Type.Number()),
  topModels: Type.Array(Type.Object({
    model: Type.String(),
    requestCount: Type.Number(),
    tokenCount: Type.Number(),
  })),
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