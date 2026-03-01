import { Type, Static } from '@sinclair/typebox';
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
  keyPrefix: Type.String(),
  subscriptionId: Type.String(),
  lastUsedAt: Type.Optional(TimestampSchema),
  createdAt: TimestampSchema,
});

// New schema for multi-model support
export const CreateApiKeySchema = Type.Object({
  modelIds: Type.Array(Type.String(), {
    minItems: 1,
    description: 'Array of model IDs to associate with this API key',
    examples: [['gpt-4', 'gpt-3.5-turbo']],
  }),
  name: Type.Optional(
    Type.String({
      minLength: 1,
      maxLength: 255,
      description: 'Human-readable name for the API key',
    }),
  ),
  expiresAt: Type.Optional(
    Type.String({
      format: 'date-time',
      description: 'ISO 8601 date-time when the key expires',
    }),
  ),
  maxBudget: Type.Optional(
    Type.Number({
      minimum: 0,
      description: 'Maximum budget for this API key',
    }),
  ),
  budgetDuration: Type.Optional(
    Type.Union([
      Type.Literal('daily'),
      Type.Literal('weekly'),
      Type.Literal('monthly'),
      Type.Literal('yearly'),
      Type.String({ pattern: '^\\d+[smhd]$|^\\d+mo$', description: 'Custom duration like 30d, 1mo, 1h' }),
    ], { description: 'Budget duration period' }),
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
  teamId: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  permissions: Type.Optional(
    Type.Object({
      allowChatCompletions: Type.Optional(Type.Boolean()),
      allowEmbeddings: Type.Optional(Type.Boolean()),
      allowCompletions: Type.Optional(Type.Boolean()),
    }),
  ),
  softBudget: Type.Optional(Type.Number()),
  guardrails: Type.Optional(Type.Array(Type.String())),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

// Legacy schema for backward compatibility
export const LegacyCreateApiKeySchema = Type.Object({
  subscriptionId: Type.String({
    description: 'DEPRECATED: Use modelIds instead. Subscription ID to associate with this API key',
    deprecated: true,
  }),
  name: Type.Optional(
    Type.String({
      minLength: 1,
      maxLength: 255,
      description: 'Human-readable name for the API key',
    }),
  ),
  expiresAt: Type.Optional(
    Type.String({
      format: 'date-time',
      description: 'ISO 8601 date-time when the key expires',
    }),
  ),
  maxBudget: Type.Optional(
    Type.Number({
      minimum: 0,
      description: 'Maximum budget for this API key',
    }),
  ),
  budgetDuration: Type.Optional(
    Type.Union([
      Type.Literal('daily'),
      Type.Literal('weekly'),
      Type.Literal('monthly'),
      Type.Literal('yearly'),
      Type.String({ pattern: '^\\d+[smhd]$|^\\d+mo$', description: 'Custom duration like 30d, 1mo, 1h' }),
    ], { description: 'Budget duration period' }),
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
  teamId: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  permissions: Type.Optional(
    Type.Object({
      allowChatCompletions: Type.Optional(Type.Boolean()),
      allowEmbeddings: Type.Optional(Type.Boolean()),
      allowCompletions: Type.Optional(Type.Boolean()),
    }),
  ),
  softBudget: Type.Optional(Type.Number()),
  guardrails: Type.Optional(Type.Array(Type.String())),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

// Union type for API endpoint
export const CreateApiKeyRequestSchema = Type.Object({
  // Required for new format
  modelIds: Type.Optional(
    Type.Array(Type.String(), {
      minItems: 1,
      description: 'Array of model IDs to associate with this API key',
      examples: [['gpt-4', 'gpt-3.5-turbo']],
    }),
  ),
  // Required for legacy format
  subscriptionId: Type.Optional(
    Type.String({
      description:
        'DEPRECATED: Use modelIds instead. Subscription ID to associate with this API key',
    }),
  ),
  // Common optional fields
  name: Type.Optional(
    Type.String({
      minLength: 1,
      maxLength: 255,
      description: 'Human-readable name for the API key',
    }),
  ),
  expiresAt: Type.Optional(
    Type.String({
      format: 'date-time',
      description: 'ISO 8601 date-time when the key expires',
    }),
  ),
  maxBudget: Type.Optional(
    Type.Number({
      minimum: 0,
      description: 'Maximum budget for this API key',
    }),
  ),
  budgetDuration: Type.Optional(
    Type.Union([
      Type.Literal('daily'),
      Type.Literal('weekly'),
      Type.Literal('monthly'),
      Type.Literal('yearly'),
      Type.String({ pattern: '^\\d+[smhd]$|^\\d+mo$', description: 'Custom duration like 30d, 1mo, 1h' }),
    ], { description: 'Budget duration period' }),
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
  teamId: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  permissions: Type.Optional(
    Type.Object({
      allowChatCompletions: Type.Optional(Type.Boolean()),
      allowEmbeddings: Type.Optional(Type.Boolean()),
      allowCompletions: Type.Optional(Type.Boolean()),
    }),
  ),
  softBudget: Type.Optional(Type.Number()),
  guardrails: Type.Optional(Type.Array(Type.String())),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

// Response schema for list endpoint with pagination
export const ApiKeyResponseSchema = Type.Object({
  data: Type.Array(
    Type.Object({
      id: Type.String(),
      name: Type.Optional(Type.String()),
      keyPrefix: Type.String(),
      models: Type.Array(Type.String()),
      modelDetails: Type.Optional(
        Type.Array(
          Type.Object({
            id: Type.String(),
            name: Type.String(),
            provider: Type.String(),
            contextLength: Type.Optional(Type.Integer()),
          }),
        ),
      ),
      subscriptionId: Type.Optional(Type.String()),
      lastUsedAt: Type.Optional(Type.String({ format: 'date-time' })),
      createdAt: Type.String({ format: 'date-time' }),
      expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
      isActive: Type.Boolean(),
      maxBudget: Type.Optional(Type.Number()),
      currentSpend: Type.Optional(Type.Number()),
      tpmLimit: Type.Optional(Type.Integer()),
      rpmLimit: Type.Optional(Type.Integer()),
      budgetDuration: Type.Optional(Type.String()),
      softBudget: Type.Optional(Type.Number()),
      budgetUtilization: Type.Optional(Type.Number()),
      maxParallelRequests: Type.Optional(Type.Integer()),
      metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
    }),
  ),
  pagination: Type.Object({
    page: Type.Integer(),
    limit: Type.Integer(),
    total: Type.Integer(),
    totalPages: Type.Integer(),
  }),
});

// Single API key response schema
export const SingleApiKeyResponseSchema = Type.Object({
  id: Type.String(),
  models: Type.Array(Type.String()),
  modelDetails: Type.Optional(
    Type.Array(
      Type.Object({
        id: Type.String(),
        name: Type.String(),
        provider: Type.String(),
        contextLength: Type.Optional(Type.Integer()),
      }),
    ),
  ),
  name: Type.Optional(Type.String()),
  keyPrefix: Type.String(),
  key: Type.Optional(Type.String({ description: 'Only included on creation' })),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
  isActive: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  lastUsedAt: Type.Optional(Type.String({ format: 'date-time' })),
  // Legacy field for backward compatibility
  subscriptionId: Type.Optional(Type.String()),
  // Quota fields
  maxBudget: Type.Optional(Type.Number()),
  currentSpend: Type.Optional(Type.Number()),
  tpmLimit: Type.Optional(Type.Integer()),
  rpmLimit: Type.Optional(Type.Integer()),
  budgetDuration: Type.Optional(Type.String()),
  softBudget: Type.Optional(Type.Number()),
  budgetUtilization: Type.Optional(Type.Number()),
  maxParallelRequests: Type.Optional(Type.Integer()),
  // LiteLLM fields
  liteLLMKeyId: Type.Optional(Type.String()),
  liteLLMInfo: Type.Optional(
    Type.Object({
      key_name: Type.String(),
      max_budget: Type.Optional(Type.Number()),
      current_spend: Type.Number(),
      models: Type.Array(Type.String()),
      tpm_limit: Type.Optional(Type.Integer()),
      rpm_limit: Type.Optional(Type.Integer()),
    }),
  ),
  // Metadata
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

// Legacy response schema for backward compatibility
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
  max_parallel_requests: Type.Optional(Type.Integer()),
  budget_duration: Type.Optional(Type.String()),
  model_max_budget: Type.Optional(
    Type.Record(
      Type.String(),
      Type.Object({
        budget_limit: Type.Number(),
        time_period: Type.String(),
      }),
    ),
  ),
  model_rpm_limit: Type.Optional(Type.Record(Type.String(), Type.Integer())),
  model_tpm_limit: Type.Optional(Type.Record(Type.String(), Type.Integer())),
  permissions: Type.Optional(
    Type.Object({
      allow_chat_completions: Type.Optional(Type.Boolean()),
      allow_embeddings: Type.Optional(Type.Boolean()),
      allow_completions: Type.Optional(Type.Boolean()),
    }),
  ),
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
  max_parallel_requests: Type.Optional(Type.Integer()),
  budget_duration: Type.Optional(Type.String()),
  model_max_budget: Type.Optional(
    Type.Record(
      Type.String(),
      Type.Object({
        budget_limit: Type.Number(),
        time_period: Type.String(),
      }),
    ),
  ),
  model_rpm_limit: Type.Optional(Type.Record(Type.String(), Type.Integer())),
  model_tpm_limit: Type.Optional(Type.Record(Type.String(), Type.Integer())),
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
    liteLLMKey: Type.Optional(
      Type.String({
        description: 'Actual LiteLLM key (masked in list views, full in individual retrieval)',
      }),
    ), // PHASE 1 FIX
    liteLLMInfo: Type.Optional(
      Type.Object({
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
      }),
    ),
    lastSyncAt: Type.Optional(TimestampSchema),
    syncStatus: Type.Optional(
      Type.Union([Type.Literal('synced'), Type.Literal('pending'), Type.Literal('error')]),
    ),
    syncError: Type.Optional(Type.String()),
  }),
]);

export const EnhancedCreateApiKeySchema = Type.Intersect([
  CreateApiKeySchema,
  Type.Object({
    maxBudget: Type.Optional(Type.Number()),
    budgetDuration: Type.Optional(
      Type.Union([
        Type.Literal('daily'),
        Type.Literal('weekly'),
        Type.Literal('monthly'),
        Type.Literal('yearly'),
        Type.String({ pattern: '^\\d+[smhd]$|^\\d+mo$' }),
      ]),
    ),
    tpmLimit: Type.Optional(Type.Number()),
    rpmLimit: Type.Optional(Type.Number()),
    allowedModels: Type.Optional(Type.Array(Type.String())),
    teamId: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
    permissions: Type.Optional(
      Type.Object({
        allowChatCompletions: Type.Optional(Type.Boolean()),
        allowEmbeddings: Type.Optional(Type.Boolean()),
        allowCompletions: Type.Optional(Type.Boolean()),
      }),
    ),
    softBudget: Type.Optional(Type.Number()),
    guardrails: Type.Optional(Type.Array(Type.String())),
  }),
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
  topModels: Type.Array(
    Type.Object({
      model: Type.String(),
      requestCount: Type.Number(),
      tokenCount: Type.Number(),
    }),
  ),
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
  subscription: Type.Optional(
    Type.Object({
      id: Type.String(),
      userId: Type.String(),
      modelId: Type.String(),
      status: Type.String(),
      remainingRequests: Type.Integer(),
      remainingTokens: Type.Integer(),
    }),
  ),
  error: Type.Optional(Type.String()),
});

// TypeScript types
export type CreateApiKeyRequest = Static<typeof CreateApiKeySchema>;
export type LegacyCreateApiKeyRequest = Static<typeof LegacyCreateApiKeySchema>;
export type ApiKeyResponse = Static<typeof ApiKeyResponseSchema>;
