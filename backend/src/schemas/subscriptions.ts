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
/**
 * Enhanced subscription schemas for LiteLLM integration
 */
export const EnhancedSubscriptionSchema = Type.Intersect([
  SubscriptionSchema,
  Type.Object({
    liteLLMInfo: Type.Optional(Type.Object({
      keyId: Type.Optional(Type.String()),
      teamId: Type.Optional(Type.String()),
      maxBudget: Type.Optional(Type.Number()),
      currentSpend: Type.Optional(Type.Number()),
      budgetDuration: Type.Optional(Type.Union([
        Type.Literal('daily'),
        Type.Literal('weekly'),
        Type.Literal('monthly'),
        Type.Literal('yearly')
      ])),
      tpmLimit: Type.Optional(Type.Number()),
      rpmLimit: Type.Optional(Type.Number()),
      allowedModels: Type.Optional(Type.Array(Type.String())),
      spendResetAt: Type.Optional(TimestampSchema),
      budgetUtilization: Type.Optional(Type.Number()),
    })),
    budgetInfo: Type.Optional(Type.Object({
      maxBudget: Type.Optional(Type.Number()),
      currentSpend: Type.Optional(Type.Number()),
      remainingBudget: Type.Optional(Type.Number()),
      budgetUtilization: Type.Optional(Type.Number()),
      spendResetAt: Type.Optional(TimestampSchema),
    })),
    rateLimits: Type.Optional(Type.Object({
      tpmLimit: Type.Optional(Type.Number()),
      rpmLimit: Type.Optional(Type.Number()),
      currentTpm: Type.Optional(Type.Number()),
      currentRpm: Type.Optional(Type.Number()),
    })),
    teamId: Type.Optional(Type.String()),
    teamInfo: Type.Optional(Type.Object({
      id: Type.String(),
      name: Type.String(),
      role: Type.Union([
        Type.Literal('admin'),
        Type.Literal('member'),
        Type.Literal('viewer')
      ]),
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

export const EnhancedCreateSubscriptionSchema = Type.Intersect([
  CreateSubscriptionSchema,
  Type.Object({
    maxBudget: Type.Optional(Type.Number({ minimum: 0 })),
    budgetDuration: Type.Optional(Type.Union([
      Type.Literal('daily'),
      Type.Literal('weekly'),
      Type.Literal('monthly'),
      Type.Literal('yearly')
    ])),
    tpmLimit: Type.Optional(Type.Number({ minimum: 0 })),
    rpmLimit: Type.Optional(Type.Number({ minimum: 0 })),
    allowedModels: Type.Optional(Type.Array(Type.String())),
    teamId: Type.Optional(Type.String()),
    softBudget: Type.Optional(Type.Number({ minimum: 0 })),
    generateApiKey: Type.Optional(Type.Boolean()),
    apiKeyAlias: Type.Optional(Type.String()),
    apiKeyTags: Type.Optional(Type.Array(Type.String())),
    apiKeyPermissions: Type.Optional(Type.Object({
      allowChatCompletions: Type.Optional(Type.Boolean()),
      allowEmbeddings: Type.Optional(Type.Boolean()),
      allowCompletions: Type.Optional(Type.Boolean()),
    })),
  })
]);

export const EnhancedUpdateSubscriptionSchema = Type.Intersect([
  UpdateSubscriptionSchema,
  Type.Object({
    maxBudget: Type.Optional(Type.Number({ minimum: 0 })),
    budgetDuration: Type.Optional(Type.Union([
      Type.Literal('daily'),
      Type.Literal('weekly'),
      Type.Literal('monthly'),
      Type.Literal('yearly')
    ])),
    tpmLimit: Type.Optional(Type.Number({ minimum: 0 })),
    rpmLimit: Type.Optional(Type.Number({ minimum: 0 })),
    allowedModels: Type.Optional(Type.Array(Type.String())),
    teamId: Type.Optional(Type.String()),
    softBudget: Type.Optional(Type.Number({ minimum: 0 })),
  })
]);

export const SubscriptionBudgetInfoSchema = Type.Object({
  subscriptionId: Type.String(),
  maxBudget: Type.Optional(Type.Number()),
  currentSpend: Type.Number(),
  budgetUtilization: Type.Number(),
  remainingBudget: Type.Optional(Type.Number()),
  budgetDuration: Type.Optional(Type.String()),
  spendResetAt: Type.Optional(TimestampSchema),
  softBudget: Type.Optional(Type.Number()),
  alertTriggered: Type.Optional(Type.Boolean()),
  lastUpdatedAt: TimestampSchema,
});

export const SubscriptionUsageAnalyticsSchema = Type.Object({
  subscriptionId: Type.String(),
  period: Type.Object({
    start: TimestampSchema,
    end: TimestampSchema,
    type: Type.Union([
      Type.Literal('day'),
      Type.Literal('week'),
      Type.Literal('month'),
      Type.Literal('year')
    ]),
  }),
  usage: Type.Object({
    requestCount: Type.Number(),
    tokenCount: Type.Number(),
    totalSpend: Type.Number(),
    averageRequestCost: Type.Number(),
    averageTokenCost: Type.Number(),
  }),
  models: Type.Array(Type.Object({
    modelId: Type.String(),
    modelName: Type.String(),
    requestCount: Type.Number(),
    tokenCount: Type.Number(),
    spend: Type.Number(),
  })),
  rateLimitEvents: Type.Optional(Type.Object({
    tpmViolations: Type.Number(),
    rpmViolations: Type.Number(),
  })),
});

export const SubscriptionSyncRequestSchema = Type.Object({
  subscriptionId: Type.String(),
  forceSync: Type.Optional(Type.Boolean()),
  syncBudget: Type.Optional(Type.Boolean()),
  syncUsage: Type.Optional(Type.Boolean()),
  syncRateLimits: Type.Optional(Type.Boolean()),
});

export const SubscriptionSyncResponseSchema = Type.Object({
  subscriptionId: Type.String(),
  syncedAt: TimestampSchema,
  success: Type.Boolean(),
  error: Type.Optional(Type.String()),
  changes: Type.Optional(Type.Object({
    budgetUpdated: Type.Optional(Type.Boolean()),
    usageUpdated: Type.Optional(Type.Boolean()),
    rateLimitsUpdated: Type.Optional(Type.Boolean()),
    keyUpdated: Type.Optional(Type.Boolean()),
  })),
});

export const BulkSubscriptionOperationSchema = Type.Object({
  subscriptionIds: Type.Array(Type.String()),
  operation: Type.Union([
    Type.Literal('suspend'),
    Type.Literal('activate'),
    Type.Literal('update_budget'),
    Type.Literal('update_limits'),
    Type.Literal('transfer_team')
  ]),
  params: Type.Optional(Type.Object({
    maxBudget: Type.Optional(Type.Number()),
    tpmLimit: Type.Optional(Type.Number()),
    rpmLimit: Type.Optional(Type.Number()),
    teamId: Type.Optional(Type.String()),
    reason: Type.Optional(Type.String()),
  })),
  executedBy: Type.String(),
});

export const BulkSubscriptionResultSchema = Type.Object({
  totalCount: Type.Number(),
  successCount: Type.Number(),
  errorCount: Type.Number(),
  results: Type.Array(Type.Object({
    subscriptionId: Type.String(),
    success: Type.Boolean(),
    error: Type.Optional(Type.String()),
  })),
  executedAt: TimestampSchema,
});

export const SubscriptionListQuerySchema = Type.Composite([
  PaginationSchema,
  Type.Object({
    status: Type.Optional(SubscriptionStatusEnum),
    modelId: Type.Optional(Type.String()),
  }),
]);

export const SubscriptionListResponseSchema = createPaginatedResponse(SubscriptionDetailsSchema);