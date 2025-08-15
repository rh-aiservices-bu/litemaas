# Multi-Model API Keys

## Overview

LiteMaaS supports multi-model API keys, allowing a single key to access multiple AI models. This feature improves key management efficiency and aligns with LiteLLM's native capabilities.

## Architecture

### Database Design

- **api_keys** table: Stores key metadata and settings
- **api_key_models** junction table: Many-to-many relationship between keys and models
- **Backward Compatibility**: Legacy `subscription_id` column maintained for existing keys

### Key Features

1. **Multi-Model Access**: One key can access multiple models
2. **API Key Editing**: Update key name, models, and metadata after creation with automatic LiteLLM synchronization
3. **Per-Key Budgets**: Set spending limits per API key
4. **Rate Limiting**: TPM/RPM limits per key
5. **Team Support**: Keys can be shared within teams
6. **Metadata & Permissions**: Custom metadata and fine-grained permissions

## Implementation Plan

### Phase 1: Database Schema Changes

#### 1.1 Create Junction Table

Create a new migration file: `backend/src/migrations/001-add-api-key-models.ts`

```typescript
export const addApiKeyModelsTable = `
-- Create junction table for many-to-many relationship between API keys and models
CREATE TABLE IF NOT EXISTS api_key_models (
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (api_key_id, model_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_key_models_api_key ON api_key_models(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_models_model ON api_key_models(model_id);

-- Add comment for documentation
COMMENT ON TABLE api_key_models IS 'Junction table linking API keys to multiple models';
`;
```

#### 1.2 Data Migration

Create migration file: `backend/src/migrations/002-migrate-api-key-subscriptions.ts`

```typescript
export const migrateApiKeySubscriptions = `
-- Migrate existing data from subscription-based to model-based associations
INSERT INTO api_key_models (api_key_id, model_id)
SELECT DISTINCT ak.id, s.model_id
FROM api_keys ak
JOIN subscriptions s ON ak.subscription_id = s.id
WHERE ak.subscription_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM api_key_models akm 
    WHERE akm.api_key_id = ak.id AND akm.model_id = s.model_id
  );

-- Make subscription_id nullable (temporary - will be dropped later)
ALTER TABLE api_keys 
ALTER COLUMN subscription_id DROP NOT NULL;

-- Add migration status column to track progress
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS migration_status VARCHAR(20) DEFAULT 'pending';

-- Mark migrated keys
UPDATE api_keys 
SET migration_status = 'migrated' 
WHERE id IN (SELECT DISTINCT api_key_id FROM api_key_models);
`;
```

#### 1.3 Update Database Migrations

Update `backend/src/lib/database-migrations.ts`:

```typescript
// Add to imports
import { addApiKeyModelsTable } from '../migrations/001-add-api-key-models';
import { migrateApiKeySubscriptions } from '../migrations/002-migrate-api-key-subscriptions';

// Add to applyMigrations function
console.log('🔑 Creating api_key_models table...');
await dbUtils.query(addApiKeyModelsTable);

console.log('📦 Migrating existing API key subscriptions...');
await dbUtils.query(migrateApiKeySubscriptions);
```

### Phase 2: Backend Implementation

#### 2.1 Update Type Definitions

Update `backend/src/types/api-key.types.ts`:

```typescript
// New interface for multi-model support
export interface CreateApiKeyRequest {
  modelIds: string[]; // Array of model IDs
  name?: string;
  expiresAt?: Date;
  maxBudget?: number;
  budgetDuration?: string;
  tpmLimit?: number;
  rpmLimit?: number;
  teamId?: string;
  tags?: string[];
  permissions?: ApiKeyPermissions;
  softBudget?: number;
  guardrails?: string[];
  metadata?: Record<string, any>;
}

// Legacy interface for backward compatibility
export interface LegacyCreateApiKeyRequest extends Omit<CreateApiKeyRequest, 'modelIds'> {
  subscriptionId: string;
}

// Update ApiKey interface
export interface ApiKey {
  id: string;
  userId: string;
  models: string[]; // Array of model IDs instead of single subscription
  name: string;
  keyHash: string;
  keyPrefix: string;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  // LiteLLM integration fields
  liteLLMKeyId?: string;
  lastSyncAt?: Date;
  syncStatus?: 'pending' | 'synced' | 'error';
  syncError?: string;
  // Budget and limits
  maxBudget?: number;
  currentSpend?: number;
  tpmLimit?: number;
  rpmLimit?: number;
  // Metadata
  metadata?: Record<string, any>;
}

// Update EnhancedApiKey to include model details
export interface EnhancedApiKey extends ApiKey {
  modelDetails?: Array<{
    id: string;
    name: string;
    provider: string;
    contextLength?: number;
  }>;
  subscriptionDetails?: Array<{
    subscriptionId: string;
    modelId: string;
    status: string;
    quotaRequests: number;
    usedRequests: number;
  }>;
}
```

#### 2.2 Update API Key Service

Update `backend/src/services/api-key.service.ts`:

```typescript
export class ApiKeyService {
  // Update createApiKey method
  async createApiKey(
    userId: string,
    request: CreateApiKeyRequest | LegacyCreateApiKeyRequest,
  ): Promise<ApiKeyWithSecret> {
    try {
      // Handle backward compatibility
      let modelIds: string[];
      let isLegacyRequest = false;

      if ('subscriptionId' in request) {
        // Legacy request - convert subscription to model
        isLegacyRequest = true;
        const subscription = await this.fastify.dbUtils.queryOne(
          `SELECT model_id, status FROM subscriptions WHERE id = $1 AND user_id = $2`,
          [request.subscriptionId, userId],
        );

        if (!subscription) {
          throw this.fastify.createNotFoundError('Subscription not found');
        }

        if (subscription.status !== 'active') {
          throw this.fastify.createValidationError(
            `Cannot create API key for ${subscription.status} subscription`,
          );
        }

        modelIds = [subscription.model_id];

        this.fastify.log.warn({
          userId,
          subscriptionId: request.subscriptionId,
          message: 'Using deprecated subscriptionId parameter. Please migrate to modelIds.',
        });
      } else {
        modelIds = request.modelIds;

        if (!modelIds || modelIds.length === 0) {
          throw this.fastify.createValidationError('At least one model must be selected');
        }
      }

      // Ensure user exists in LiteLLM
      await this.ensureUserExistsInLiteLLM(userId);

      // Validate user has active subscriptions for all requested models
      const validModels = await this.fastify.dbUtils.query(
        `SELECT DISTINCT s.model_id, s.id as subscription_id, 
                m.name as model_name, m.provider
         FROM subscriptions s
         JOIN models m ON s.model_id = m.id
         WHERE s.user_id = $1 
           AND s.status = 'active' 
           AND s.model_id = ANY($2::text[])`,
        [userId, modelIds],
      );

      const validModelIds = validModels.map((m) => m.model_id);
      const invalidModels = modelIds.filter((id) => !validModelIds.includes(id));

      if (invalidModels.length > 0) {
        throw this.fastify.createValidationError(
          `You do not have active subscriptions for the following models: ${invalidModels.join(', ')}`,
        );
      }

      // Check API key limits per user
      const existingKeysCount = await this.fastify.dbUtils.queryOne(
        `SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = true`,
        [userId],
      );

      const maxKeysPerUser = 10;
      if (parseInt(existingKeysCount.count) >= maxKeysPerUser) {
        throw this.fastify.createValidationError(
          `Maximum ${maxKeysPerUser} active API keys allowed per user`,
        );
      }

      // Generate secure API key
      const { key, keyHash, keyPrefix } = this.generateApiKey();

      // Create API key in LiteLLM with multiple models
      const liteLLMRequest: LiteLLMKeyGenerationRequest = {
        key_alias: request.name || `key-${Date.now()}`,
        duration: request.expiresAt ? this.calculateDuration(request.expiresAt) : undefined,
        models: modelIds, // Pass all model IDs
        max_budget: request.maxBudget,
        user_id: userId,
        team_id: request.teamId,
        tpm_limit: request.tpmLimit,
        rpm_limit: request.rpmLimit,
        budget_duration: request.budgetDuration,
        permissions: request.permissions
          ? {
              allow_chat_completions: request.permissions.allowChatCompletions,
              allow_embeddings: request.permissions.allowEmbeddings,
              allow_completions: request.permissions.allowCompletions,
            }
          : undefined,
        tags: request.tags,
        soft_budget: request.softBudget,
        guardrails: request.guardrails,
        metadata: {
          litemaas_key_id: keyPrefix,
          created_by: 'litemaas',
          model_count: modelIds.length,
          legacy_request: isLegacyRequest,
          ...request.metadata,
        },
      };

      const liteLLMResponse = await this.liteLLMService.generateApiKey(liteLLMRequest);

      // Begin transaction for atomicity
      const client = await this.fastify.pg.connect();

      try {
        await client.query('BEGIN');

        // Store the API key (without subscription_id for new keys)
        const apiKey = await client.query(
          `INSERT INTO api_keys (
            user_id, name, key_hash, key_prefix, 
            expires_at, is_active, lite_llm_key_id,
            max_budget, current_spend, tpm_limit, rpm_limit,
            last_sync_at, sync_status, metadata
            ${isLegacyRequest ? ', subscription_id' : ''}
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14${isLegacyRequest ? ', $15' : ''})
          RETURNING *`,
          [
            userId,
            request.name,
            keyHash,
            keyPrefix,
            request.expiresAt,
            true,
            liteLLMResponse.key,
            request.maxBudget,
            0,
            request.tpmLimit,
            request.rpmLimit,
            new Date(),
            'synced',
            request.metadata || {},
            ...(isLegacyRequest ? [request.subscriptionId] : []),
          ],
        );

        // Insert model associations
        for (const modelId of modelIds) {
          await client.query(`INSERT INTO api_key_models (api_key_id, model_id) VALUES ($1, $2)`, [
            apiKey.rows[0].id,
            modelId,
          ]);
        }

        // Create audit log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            'API_KEY_CREATE',
            'API_KEY',
            apiKey.rows[0].id,
            {
              name: request.name,
              keyPrefix,
              liteLLMKeyId: liteLLMResponse.key,
              models: modelIds,
              modelCount: modelIds.length,
              legacy: isLegacyRequest,
            },
          ],
        );

        await client.query('COMMIT');

        this.fastify.log.info(
          {
            userId,
            apiKeyId: apiKey.rows[0].id,
            keyPrefix,
            liteLLMKeyId: liteLLMResponse.key,
            models: modelIds,
            modelCount: modelIds.length,
          },
          'API key created with multi-model support',
        );

        return {
          ...this.mapToEnhancedApiKey(apiKey.rows[0], liteLLMResponse),
          models: modelIds,
          modelDetails: validModels,
          key, // Only include the actual key on creation
        };
      } catch (error) {
        await client.query('ROLLBACK');

        // Try to clean up in LiteLLM if key was created
        if (liteLLMResponse?.key) {
          try {
            await this.liteLLMService.deleteKey(liteLLMResponse.key);
          } catch (cleanupError) {
            this.fastify.log.error(cleanupError, 'Failed to cleanup LiteLLM key after error');
          }
        }

        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      this.fastify.log.error(error, 'Failed to create API key');
      throw error;
    }
  }

  // Update getUserApiKeys to include models
  async getUserApiKeys(userId: string): Promise<EnhancedApiKey[]> {
    try {
      if (this.shouldUseMockData()) {
        return this.MOCK_API_KEYS;
      }

      const apiKeys = await this.fastify.dbUtils.query(
        `SELECT ak.*, 
           ARRAY_AGG(DISTINCT akm.model_id) FILTER (WHERE akm.model_id IS NOT NULL) as models,
           ARRAY_AGG(DISTINCT jsonb_build_object(
             'id', m.id,
             'name', m.name,
             'provider', m.provider,
             'context_length', m.context_length
           )) FILTER (WHERE m.id IS NOT NULL) as model_details
         FROM api_keys ak
         LEFT JOIN api_key_models akm ON ak.id = akm.api_key_id
         LEFT JOIN models m ON akm.model_id = m.id
         WHERE ak.user_id = $1
         GROUP BY ak.id
         ORDER BY ak.created_at DESC`,
        [userId],
      );

      // For backward compatibility, include model from subscription if no models in junction table
      for (const key of apiKeys) {
        if ((!key.models || key.models.length === 0) && key.subscription_id) {
          const subscription = await this.fastify.dbUtils.queryOne(
            `SELECT s.model_id, m.name, m.provider, m.context_length
             FROM subscriptions s
             JOIN models m ON s.model_id = m.id
             WHERE s.id = $1`,
            [key.subscription_id],
          );

          if (subscription) {
            key.models = [subscription.model_id];
            key.model_details = [
              {
                id: subscription.model_id,
                name: subscription.name,
                provider: subscription.provider,
                context_length: subscription.context_length,
              },
            ];
          }
        }
      }

      // Sync with LiteLLM if needed
      const keysToSync = apiKeys.filter(
        (key) =>
          key.sync_status === 'pending' ||
          !key.last_sync_at ||
          new Date() - new Date(key.last_sync_at) > 3600000, // 1 hour
      );

      if (keysToSync.length > 0) {
        await Promise.all(keysToSync.map((key) => this.syncApiKeyWithLiteLLM(key.id, userId)));
      }

      return apiKeys.map((key) => this.mapToEnhancedApiKey(key));
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get user API keys');
      throw error;
    }
  }

  // Update validation to check models
  async validateApiKey(keyHash: string): Promise<ApiKeyValidation> {
    try {
      const apiKey = await this.fastify.dbUtils.queryOne(
        `SELECT ak.*, 
           ARRAY_AGG(DISTINCT akm.model_id) FILTER (WHERE akm.model_id IS NOT NULL) as models
         FROM api_keys ak
         LEFT JOIN api_key_models akm ON ak.id = akm.api_key_id
         WHERE ak.key_hash = $1 AND ak.is_active = true
         GROUP BY ak.id`,
        [keyHash],
      );

      if (!apiKey) {
        return { isValid: false, error: 'Invalid API key' };
      }

      // Check expiration
      if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
        return { isValid: false, error: 'API key expired' };
      }

      // For backward compatibility
      if ((!apiKey.models || apiKey.models.length === 0) && apiKey.subscription_id) {
        const subscription = await this.fastify.dbUtils.queryOne(
          `SELECT model_id FROM subscriptions WHERE id = $1`,
          [apiKey.subscription_id],
        );
        if (subscription) {
          apiKey.models = [subscription.model_id];
        }
      }

      // Update last used
      await this.updateLastUsed(apiKey.id);

      return {
        isValid: true,
        apiKey: {
          id: apiKey.id,
          userId: apiKey.user_id,
          models: apiKey.models || [],
          permissions: apiKey.permissions,
          metadata: apiKey.metadata,
        },
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to validate API key');
      return { isValid: false, error: 'Validation failed' };
    }
  }
}
```

#### 2.3 Update API Schema

Update `backend/src/schemas/api-keys.ts`:

```typescript
import { Type, Static } from '@sinclair/typebox';

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
    Type.String({
      enum: ['daily', 'weekly', 'monthly', 'yearly', 'lifetime'],
      default: 'monthly',
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
  ...Type.Omit(CreateApiKeySchema, ['modelIds']).properties,
});

// Union type for API endpoint
export const CreateApiKeyRequestSchema = Type.Union([CreateApiKeySchema, LegacyCreateApiKeySchema]);

// Response schema
export const ApiKeyResponseSchema = Type.Object({
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
  name: Type.String(),
  keyPrefix: Type.String(),
  key: Type.Optional(Type.String({ description: 'Only included on creation' })),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
  isActive: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  lastUsedAt: Type.Optional(Type.String({ format: 'date-time' })),
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

export type CreateApiKeyRequest = Static<typeof CreateApiKeySchema>;
export type LegacyCreateApiKeyRequest = Static<typeof LegacyCreateApiKeySchema>;
export type ApiKeyResponse = Static<typeof ApiKeyResponseSchema>;
```

#### 2.4 Update API Routes

Update `backend/src/routes/api-keys.ts`:

```typescript
// Update the POST endpoint to handle both formats
fastify.post<{
  Body: CreateApiKeyRequest | LegacyCreateApiKeyRequest;
}>(
  '/',
  {
    schema: {
      description: 'Create a new API key associated with one or more models',
      tags: ['API Keys'],
      body: CreateApiKeyRequestSchema,
      response: {
        201: ApiKeyResponseSchema,
      },
    },
    preHandler: fastify.authenticate,
  },
  async (request, reply) => {
    const userId = request.user.id;

    // Log deprecation warning for legacy requests
    if ('subscriptionId' in request.body) {
      request.log.warn(
        {
          userId,
          subscriptionId: request.body.subscriptionId,
        },
        'Deprecated subscriptionId parameter used in API key creation',
      );
    }

    const apiKey = await apiKeyService.createApiKey(userId, request.body);

    return reply.code(201).send(apiKey);
  },
);

// Update GET endpoint response
fastify.get<{
  Querystring: PaginationQuery;
}>(
  '/',
  {
    schema: {
      description: 'Get all API keys for the authenticated user',
      tags: ['API Keys'],
      querystring: PaginationQuerySchema,
      response: {
        200: Type.Object({
          data: Type.Array(ApiKeyResponseSchema),
          pagination: PaginationSchema,
        }),
      },
    },
    preHandler: fastify.authenticate,
  },
  async (request, reply) => {
    const userId = request.user.id;
    const { page = 1, limit = 20 } = request.query;

    const apiKeys = await apiKeyService.getUserApiKeys(userId);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedKeys = apiKeys.slice(startIndex, endIndex);

    return {
      data: paginatedKeys,
      pagination: {
        page,
        limit,
        total: apiKeys.length,
        totalPages: Math.ceil(apiKeys.length / limit),
      },
    };
  },
);
```

### Phase 3: Frontend Implementation

#### 3.1 Update Types

Create/Update `frontend/src/types/api-keys.types.ts`:

```typescript
// Request types
export interface CreateApiKeyRequest {
  modelIds: string[];
  name?: string;
  expiresAt?: string;
  maxBudget?: number;
  budgetDuration?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';
  tpmLimit?: number;
  rpmLimit?: number;
  metadata?: Record<string, any>;
}

// Response types
export interface ApiKey {
  id: string;
  models: string[];
  modelDetails?: Array<{
    id: string;
    name: string;
    provider: string;
    contextLength?: number;
  }>;
  name: string;
  keyPrefix: string;
  key?: string; // Only present on creation
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
  liteLLMInfo?: {
    key_name: string;
    max_budget?: number;
    current_spend: number;
    models: string[];
    tpm_limit?: number;
    rpm_limit?: number;
  };
  metadata?: Record<string, any>;
}

// For display
export interface ApiKeyDisplay extends ApiKey {
  fullKey?: string;
  status: 'active' | 'expired' | 'revoked';
  usageCount: number;
  rateLimit: number;
  description?: string;
}
```

#### 3.2 Update API Service

Update `frontend/src/services/apiKeys.service.ts`:

```typescript
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { CreateApiKeyRequest, ApiKey, ApiKeyDisplay } from '../types/api-keys.types';

class ApiKeysService {
  private baseURL = `${API_BASE_URL}/api/api-keys`;

  async createApiKey(request: CreateApiKeyRequest): Promise<ApiKey> {
    const response = await axios.post<ApiKey>(this.baseURL, request);
    return response.data;
  }

  async getApiKeys(
    page = 1,
    limit = 20,
  ): Promise<{
    data: ApiKeyDisplay[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const response = await axios.get(this.baseURL, {
      params: { page, limit },
    });

    // Transform for display
    const displayKeys = response.data.data.map(
      (key: ApiKey): ApiKeyDisplay => ({
        ...key,
        fullKey: key.key || `${key.keyPrefix}${'*'.repeat(32)}`,
        status: this.getKeyStatus(key),
        usageCount: key.liteLLMInfo?.current_spend || 0,
        rateLimit: key.liteLLMInfo?.rpm_limit || 1000,
        description: key.metadata?.description as string,
      }),
    );

    return {
      data: displayKeys,
      pagination: response.data.pagination,
    };
  }

  async deleteApiKey(keyId: string): Promise<void> {
    await axios.delete(`${this.baseURL}/${keyId}`);
  }

  private getKeyStatus(key: ApiKey): 'active' | 'expired' | 'revoked' {
    if (!key.isActive) return 'revoked';
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return 'expired';
    return 'active';
  }
}

export const apiKeysService = new ApiKeysService();
export type { CreateApiKeyRequest, ApiKey, ApiKeyDisplay };
```

#### 3.3 Update ApiKeysPage Component

Update `frontend/src/pages/ApiKeysPage.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import {
  PageSection,
  Title,
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateVariant,
  Modal,
  ModalVariant,
  ModalBody,
  Form,
  FormGroup,
  TextInput,
  Checkbox,
  Alert,
  Card,
  CardBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Flex,
  FlexItem,
  Content,
  ContentVariants,
  Spinner,
  Bullseye,
  Tooltip,
  ClipboardCopy,
  ClipboardCopyVariant,
  CodeBlock,
  CodeBlockCode,
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core';
import {
  KeyIcon,
  PlusCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  CopyIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../contexts/NotificationContext';
import { apiKeysService, ApiKeyDisplay, CreateApiKeyRequest } from '../services/apiKeys.service';
import { subscriptionsService, Subscription } from '../services/subscriptions.service';
import { modelsService, Model } from '../services/models.service';

interface SubscribedModel extends Model {
  subscriptionId: string;
  quotaRequests: number;
  usedRequests: number;
}

const ApiKeysPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

  // State for API keys
  const [apiKeys, setApiKeys] = useState<ApiKeyDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKeyDisplay | null>(null);
  const [keyToDelete, setKeyToDelete] = useState<ApiKeyDisplay | null>(null);

  // State for form
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [newKeyExpiration, setNewKeyExpiration] = useState('never');
  const [newKeyRateLimit, setNewKeyRateLimit] = useState('1000');
  const [newKeyBudget, setNewKeyBudget] = useState('100');
  const [creatingKey, setCreatingKey] = useState(false);

  // State for generated key display
  const [generatedKey, setGeneratedKey] = useState<ApiKeyDisplay | null>(null);
  const [showGeneratedKey, setShowGeneratedKey] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  // State for models
  const [subscribedModels, setSubscribedModels] = useState<SubscribedModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Load API keys
  const loadApiKeys = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiKeysService.getApiKeys();
      setApiKeys(response.data);
    } catch (err) {
      console.error('Failed to load API keys:', err);
      setError('Failed to load API keys. Please try again.');
      addNotification({
        title: 'Error',
        description: 'Failed to load API keys from the server.',
        variant: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load user's subscribed models
  const loadSubscribedModels = async () => {
    try {
      setLoadingModels(true);

      // Get user's active subscriptions
      const subscriptionsResponse = await subscriptionsService.getSubscriptions(1, 100);
      const activeSubscriptions = subscriptionsResponse.data.filter(sub => sub.status === 'active');

      // Get unique model IDs and fetch model details
      const modelPromises = activeSubscriptions.map(async (sub) => {
        try {
          const model = await modelsService.getModel(sub.modelId);
          return {
            ...model,
            subscriptionId: sub.id,
            quotaRequests: sub.quotaRequests,
            usedRequests: sub.usedRequests,
          } as SubscribedModel;
        } catch (err) {
          console.error(`Failed to load model ${sub.modelId}:`, err);
          return null;
        }
      });

      const models = await Promise.all(modelPromises);
      const validModels = models.filter(m => m !== null) as SubscribedModel[];

      setSubscribedModels(validModels);
    } catch (err) {
      console.error('Failed to load subscribed models:', err);
      addNotification({
        title: 'Error',
        description: 'Failed to load available models.',
        variant: 'danger'
      });
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
    loadSubscribedModels();
  }, []);

  // Modal handlers
  const handleCreateApiKey = () => {
    setNewKeyName('');
    setSelectedModelIds([]);
    setNewKeyExpiration('never');
    setNewKeyRateLimit('1000');
    setNewKeyBudget('100');
    setIsCreateModalOpen(true);
  };

  const handleSaveApiKey = async () => {
    if (!newKeyName.trim()) {
      addNotification({
        title: 'Validation Error',
        description: 'API key name is required',
        variant: 'danger'
      });
      return;
    }

    if (selectedModelIds.length === 0) {
      addNotification({
        title: 'Validation Error',
        description: 'Please select at least one model for this API key',
        variant: 'danger'
      });
      return;
    }

    setCreatingKey(true);

    try {
      const request: CreateApiKeyRequest = {
        modelIds: selectedModelIds,
        name: newKeyName,
        expiresAt: newKeyExpiration !== 'never'
          ? new Date(Date.now() + parseInt(newKeyExpiration) * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
        maxBudget: parseFloat(newKeyBudget),
        rpmLimit: parseInt(newKeyRateLimit),
        metadata: {
          createdFrom: 'web-ui',
          modelCount: selectedModelIds.length,
        }
      };

      const newKey = await apiKeysService.createApiKey(request);

      // Convert to display format
      const displayKey: ApiKeyDisplay = {
        ...newKey,
        fullKey: newKey.key!, // Key is present on creation
        status: 'active',
        usageCount: 0,
        rateLimit: parseInt(newKeyRateLimit),
      };

      // Refresh the API keys list
      await loadApiKeys();

      setGeneratedKey(displayKey);
      setShowGeneratedKey(true);
      setIsCreateModalOpen(false);

      addNotification({
        title: 'API Key Created',
        description: `${newKeyName} has been created successfully with ${selectedModelIds.length} model(s)`,
        variant: 'success'
      });
    } catch (err: any) {
      console.error('Failed to create API key:', err);
      addNotification({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to create API key. Please try again.',
        variant: 'danger'
      });
    } finally {
      setCreatingKey(false);
    }
  };

  const handleViewKey = (apiKey: ApiKeyDisplay) => {
    setSelectedApiKey(apiKey);
    setIsViewModalOpen(true);
  };

  const handleDeleteKey = (apiKey: ApiKeyDisplay) => {
    setKeyToDelete(apiKey);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteKey = async () => {
    if (!keyToDelete) return;

    try {
      await apiKeysService.deleteApiKey(keyToDelete.id);

      // Refresh the API keys list
      await loadApiKeys();

      addNotification({
        title: 'API Key Deleted',
        description: `${keyToDelete.name} has been deleted`,
        variant: 'success'
      });
    } catch (err) {
      console.error('Failed to delete API key:', err);
      addNotification({
        title: 'Error',
        description: 'Failed to delete API key. Please try again.',
        variant: 'danger'
      });
    } finally {
      setIsDeleteModalOpen(false);
      setKeyToDelete(null);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newVisibleKeys = new Set(visibleKeys);
    if (newVisibleKeys.has(keyId)) {
      newVisibleKeys.delete(keyId);
    } else {
      newVisibleKeys.add(keyId);
    }
    setVisibleKeys(newVisibleKeys);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addNotification({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
      variant: 'info'
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'success',
      revoked: 'warning',
      expired: 'danger'
    } as const;

    const icons = {
      active: <CheckCircleIcon />,
      revoked: <ExclamationTriangleIcon />,
      expired: <ExclamationTriangleIcon />
    };

    return (
      <Badge color={variants[status as keyof typeof variants]}>
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsXs' }}>
          <FlexItem>{icons[status as keyof typeof icons]}</FlexItem>
          <FlexItem>{status.charAt(0).toUpperCase() + status.slice(1)}</FlexItem>
        </Flex>
      </Badge>
    );
  };

  // Model selection component
  const ModelSelector = () => (
    <FormGroup label="Select Models" isRequired fieldId="key-models">
      <div style={{
        maxHeight: '300px',
        overflowY: 'auto',
        border: '1px solid var(--pf-v6-global--BorderColor--100)',
        borderRadius: '3px',
        padding: '0.5rem'
      }}>
        {loadingModels ? (
          <Bullseye>
            <Spinner size="md" />
          </Bullseye>
        ) : subscribedModels.length === 0 ? (
          <Alert variant="warning" isInline title="No models available">
            You need active subscriptions to create API keys. Please subscribe to models first.
          </Alert>
        ) : (
          <div>
            {subscribedModels.map((model) => (
              <div key={model.id} style={{ marginBottom: '0.5rem' }}>
                <Checkbox
                  id={`model-${model.id}`}
                  label={
                    <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsNone' }}>
                      <FlexItem>
                        <strong>{model.name}</strong> ({model.provider})
                      </FlexItem>
                      <FlexItem>
                        <Content component={ContentVariants.small} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                          {model.description || 'No description available'}
                        </Content>
                      </FlexItem>
                      <FlexItem>
                        <Content component={ContentVariants.small} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                          Usage: {model.usedRequests.toLocaleString()} / {model.quotaRequests.toLocaleString()} requests
                        </Content>
                      </FlexItem>
                    </Flex>
                  }
                  isChecked={selectedModelIds.includes(model.id)}
                  onChange={(_, checked) => {
                    if (checked) {
                      setSelectedModelIds([...selectedModelIds, model.id]);
                    } else {
                      setSelectedModelIds(selectedModelIds.filter(id => id !== model.id));
                    }
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      {selectedModelIds.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <Content component={ContentVariants.small}>
            Selected {selectedModelIds.length} model{selectedModelIds.length !== 1 ? 's' : ''}
          </Content>
        </div>
      )}
    </FormGroup>
  );

  // Models display component
  const ModelsDisplay = ({ models, modelDetails }: { models: string[], modelDetails?: any[] }) => (
    <Flex spaceItems={{ default: 'spaceItemsXs' }} style={{ flexWrap: 'wrap' }}>
      {models.map((modelId) => {
        const details = modelDetails?.find(m => m.id === modelId);
        const subscribedModel = subscribedModels.find(m => m.id === modelId);
        const displayName = details?.name || subscribedModel?.name || modelId;
        const provider = details?.provider || subscribedModel?.provider || 'Unknown';

        return (
          <FlexItem key={modelId}>
            <Tooltip content={`${displayName} (${provider})`}>
              <Badge isRead>{displayName}</Badge>
            </Tooltip>
          </FlexItem>
        );
      })}
    </Flex>
  );

  if (loading) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            API Keys
          </Title>
        </PageSection>
        <PageSection>
          <Bullseye>
            <EmptyState variant={EmptyStateVariant.lg}>
              <Spinner size="xl" />
              <Title headingLevel="h2" size="lg">
                Loading API Keys...
              </Title>
              <EmptyStateBody>
                Retrieving your API key information
              </EmptyStateBody>
            </EmptyState>
          </Bullseye>
        </PageSection>
      </>
    );
  }

  return (
    <>
      <PageSection variant="secondary">
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Title headingLevel="h1" size="2xl">
              API Keys
            </Title>
            <Content component={ContentVariants.p}>
              Manage API keys for accessing LiteMaaS services with multiple models
            </Content>
          </FlexItem>
          <FlexItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreateApiKey}>
              Create API Key
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>

      <PageSection>
        {error ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <KeyIcon />
            <Title headingLevel="h2" size="lg">
              Error loading API keys
            </Title>
            <EmptyStateBody>
              {error}
            </EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary" onClick={loadApiKeys}>
                Retry
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : apiKeys.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <KeyIcon />
            <Title headingLevel="h2" size="lg">
              No API keys found
            </Title>
            <EmptyStateBody>
              Create your first API key to start using LiteMaaS services. You can associate multiple models with each key.
            </EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreateApiKey}>
                Create API Key
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : (
          <Card>
            <CardBody>
              <Table aria-label="API Keys Table" variant="compact">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Models</Th>
                    <Th>Key</Th>
                    <Th>Status</Th>
                    <Th>Last Used</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {apiKeys.map((apiKey) => (
                    <Tr key={apiKey.id}>
                      <Td>
                        <Flex direction={{ default: 'column' }}>
                          <FlexItem>
                            <strong>{apiKey.name}</strong>
                          </FlexItem>
                          {apiKey.description && (
                            <FlexItem>
                              <Content component={ContentVariants.small} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                                {apiKey.description}
                              </Content>
                            </FlexItem>
                          )}
                        </Flex>
                      </Td>
                      <Td>
                        <ModelsDisplay
                          models={apiKey.models}
                          modelDetails={apiKey.modelDetails}
                        />
                      </Td>
                      <Td>
                        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>
                            <code style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                              {visibleKeys.has(apiKey.id) ? apiKey.fullKey : apiKey.keyPrefix + '************'}
                            </code>
                          </FlexItem>
                          <FlexItem>
                            <Tooltip content={visibleKeys.has(apiKey.id) ? 'Hide key' : 'Show key'}>
                              <Button
                                variant="plain"
                                size="sm"
                                onClick={() => toggleKeyVisibility(apiKey.id)}
                                icon={visibleKeys.has(apiKey.id) ? <EyeSlashIcon /> : <EyeIcon />}
                              />
                            </Tooltip>
                          </FlexItem>
                          <FlexItem>
                            <Tooltip content="Copy to clipboard">
                              <Button
                                variant="plain"
                                size="sm"
                                onClick={() => copyToClipboard(apiKey.fullKey || '', 'API key')}
                                icon={<CopyIcon />}
                              />
                            </Tooltip>
                          </FlexItem>
                        </Flex>
                      </Td>
                      <Td>
                        {getStatusBadge(apiKey.status)}
                      </Td>
                      <Td>
                        <Content component={ContentVariants.small}>
                          {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : 'Never'}
                        </Content>
                      </Td>
                      <Td>
                        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>
                            <Button variant="secondary" size="sm" onClick={() => handleViewKey(apiKey)}>
                              View
                            </Button>
                          </FlexItem>
                          <FlexItem>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteKey(apiKey)}
                              isDisabled={apiKey.status !== 'active'}
                              icon={<TrashIcon />}
                            >
                              Delete
                            </Button>
                          </FlexItem>
                        </Flex>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
        )}
      </PageSection>

      {/* Create API Key Modal */}
      <Modal
        variant={ModalVariant.medium}
        title="Create API Key"
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      >
        <ModalBody>
          <Form>
            <FormGroup label="Name" isRequired fieldId="key-name">
              <TextInput
                isRequired
                type="text"
                id="key-name"
                value={newKeyName}
                onChange={(_, value) => setNewKeyName(value)}
                placeholder="e.g., Production API Key"
              />
            </FormGroup>

            <ModelSelector />

            <FormGroup label="Rate Limit (requests per minute)" fieldId="key-rate-limit">
              <FormSelect
                value={newKeyRateLimit}
                onChange={(_, value) => setNewKeyRateLimit(value)}
                id="key-rate-limit"
              >
                <FormSelectOption value="100" label="100 req/min (Basic)" />
                <FormSelectOption value="500" label="500 req/min (Standard)" />
                <FormSelectOption value="1000" label="1,000 req/min (Premium)" />
                <FormSelectOption value="5000" label="5,000 req/min (Enterprise)" />
              </FormSelect>
            </FormGroup>

            <FormGroup label="Budget Limit ($)" fieldId="key-budget">
              <FormSelect
                value={newKeyBudget}
                onChange={(_, value) => setNewKeyBudget(value)}
                id="key-budget"
              >
                <FormSelectOption value="10" label="$10 / month" />
                <FormSelectOption value="50" label="$50 / month" />
                <FormSelectOption value="100" label="$100 / month" />
                <FormSelectOption value="500" label="$500 / month" />
                <FormSelectOption value="1000" label="$1,000 / month" />
              </FormSelect>
            </FormGroup>

            <FormGroup label="Expiration" fieldId="key-expiration">
              <FormSelect
                value={newKeyExpiration}
                onChange={(_, value) => setNewKeyExpiration(value)}
                id="key-expiration"
              >
                <FormSelectOption value="never" label="Never expires" />
                <FormSelectOption value="30" label="30 days" />
                <FormSelectOption value="90" label="90 days" />
                <FormSelectOption value="365" label="1 year" />
              </FormSelect>
            </FormGroup>
          </Form>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              onClick={handleSaveApiKey}
              isLoading={creatingKey}
              isDisabled={selectedModelIds.length === 0}
            >
              {creatingKey ? 'Creating...' : 'Create API Key'}
            </Button>
            <Button variant="link" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* View API Key Modal */}
      <Modal
        variant={ModalVariant.large}
        title={selectedApiKey?.name || ''}
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
      >
        <ModalBody>
          {selectedApiKey && (
            <>
              <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }} style={{ marginBottom: '1rem' }}>
                <FlexItem>
                  <Title headingLevel="h2" size="xl">{selectedApiKey.name}</Title>
                </FlexItem>
                <FlexItem>
                  {getStatusBadge(selectedApiKey.status)}
                </FlexItem>
              </Flex>

              <FormGroup label="API Key" fieldId="view-key">
                <ClipboardCopy
                  hoverTip="Copy"
                  clickTip="Copied"
                  variant={ClipboardCopyVariant.expansion}
                  isReadOnly
                  isExpanded={visibleKeys.has(selectedApiKey.id)}
                  onToggle={() => toggleKeyVisibility(selectedApiKey.id)}
                >
                  {selectedApiKey.fullKey}
                </ClipboardCopy>
              </FormGroup>

              <div style={{ marginTop: '1rem' }}>
                <Content component={ContentVariants.h3}>Associated Models</Content>
                <Card isCompact>
                  <CardBody>
                    <ModelsDisplay
                      models={selectedApiKey.models}
                      modelDetails={selectedApiKey.modelDetails}
                    />
                  </CardBody>
                </Card>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Content component={ContentVariants.h3}>Key Information</Content>
                <Table aria-label="Key details" variant="compact">
                  <Tbody>
                    <Tr>
                      <Td><strong>Created</strong></Td>
                      <Td>{new Date(selectedApiKey.createdAt).toLocaleDateString()}</Td>
                    </Tr>
                    <Tr>
                      <Td><strong>Last Used</strong></Td>
                      <Td>{selectedApiKey.lastUsedAt ? new Date(selectedApiKey.lastUsedAt).toLocaleDateString() : 'Never'}</Td>
                    </Tr>
                    <Tr>
                      <Td><strong>Total Spend</strong></Td>
                      <Td>${selectedApiKey.usageCount.toFixed(2)}</Td>
                    </Tr>
                    <Tr>
                      <Td><strong>Rate Limit</strong></Td>
                      <Td>{selectedApiKey.rateLimit.toLocaleString()} requests/minute</Td>
                    </Tr>
                    {selectedApiKey.expiresAt && (
                      <Tr>
                        <Td><strong>Expires</strong></Td>
                        <Td>{new Date(selectedApiKey.expiresAt).toLocaleDateString()}</Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Content component={ContentVariants.h3}>Usage Example</Content>
                <CodeBlock>
                  <CodeBlockCode>
{`curl -X POST https://api.litemaas.com/v1/chat/completions \\
  -H "Authorization: Bearer ${selectedApiKey.fullKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedApiKey.models[0] || 'gpt-4'}",
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ]
  }'`}
                  </CodeBlockCode>
                </CodeBlock>
              </div>

              {selectedApiKey.status === 'expired' && (
                <Alert variant="danger" title="Key Expired" style={{ marginTop: '1rem' }}>
                  This API key expired on {selectedApiKey.expiresAt && new Date(selectedApiKey.expiresAt).toLocaleDateString()}.
                </Alert>
              )}
            </>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button variant="link" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Generated Key Modal */}
      <Modal
        variant={ModalVariant.medium}
        title="API Key Created Successfully"
        isOpen={showGeneratedKey}
        onClose={() => setShowGeneratedKey(false)}
      >
        <ModalBody>
          {generatedKey && (
            <>
              <Alert variant="success" title="Success!" style={{ marginBottom: '1rem' }}>
                Your API key has been created successfully. Make sure to copy it now - you won't be able to see it again!
              </Alert>

              <FormGroup label="Your new API key" fieldId="generated-key">
                <ClipboardCopy
                  hoverTip="Copy"
                  clickTip="Copied"
                  variant={ClipboardCopyVariant.expansion}
                  isReadOnly
                >
                  {generatedKey.fullKey}
                </ClipboardCopy>
              </FormGroup>

              <div style={{ marginTop: '1rem' }}>
                <Content component={ContentVariants.h3}>Key Details</Content>
                <Table aria-label="Generated key details" variant="compact">
                  <Tbody>
                    <Tr>
                      <Td><strong>Name</strong></Td>
                      <Td>{generatedKey.name}</Td>
                    </Tr>
                    <Tr>
                      <Td><strong>Models</strong></Td>
                      <Td>
                        <ModelsDisplay
                          models={generatedKey.models}
                          modelDetails={generatedKey.modelDetails}
                        />
                      </Td>
                    </Tr>
                    <Tr>
                      <Td><strong>Rate Limit</strong></Td>
                      <Td>{generatedKey.rateLimit.toLocaleString()} requests/minute</Td>
                    </Tr>
                    {generatedKey.expiresAt && (
                      <Tr>
                        <Td><strong>Expires</strong></Td>
                        <Td>{new Date(generatedKey.expiresAt).toLocaleDateString()}</Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </div>
            </>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={() => setShowGeneratedKey(false)}>
              Close
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Delete API Key"
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      >
        <ModalBody>
          {keyToDelete && (
            <>
              <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }} style={{ marginBottom: '1rem' }}>
                <FlexItem>
                  <ExclamationTriangleIcon color="var(--pf-v6-global--danger-color--100)" />
                </FlexItem>
                <FlexItem>
                  <Content component={ContentVariants.p}>
                    Are you sure you want to delete the API key <strong>{keyToDelete.name}</strong>?
                  </Content>
                </FlexItem>
              </Flex>

              <Alert variant="danger" title="Warning" style={{ marginBottom: '1rem' }}>
                This action cannot be undone. The API key will be permanently removed and applications using this key will lose access immediately.
              </Alert>

              <div style={{ marginTop: '1rem' }}>
                <Content component={ContentVariants.p}>
                  This key is associated with {keyToDelete.models.length} model{keyToDelete.models.length !== 1 ? 's' : ''}.
                </Content>
              </div>
            </>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button variant="danger" onClick={confirmDeleteKey}>
              Delete API Key
            </Button>
            <Button variant="link" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ApiKeysPage;
```

### Phase 4: Testing Strategy

#### 4.1 Unit Tests

Create test file: `backend/tests/unit/services/api-key-multi-model.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiKeyService } from '../../../src/services/api-key.service';

describe('ApiKeyService - Multi-Model Support', () => {
  let service: ApiKeyService;
  let mockFastify: any;

  beforeEach(() => {
    mockFastify = {
      dbUtils: {
        query: vi.fn(),
        queryOne: vi.fn(),
      },
      pg: {
        connect: vi.fn().mockResolvedValue({
          query: vi.fn(),
          release: vi.fn(),
        }),
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
      createNotFoundError: vi.fn((msg) => new Error(msg)),
      createValidationError: vi.fn((msg) => new Error(msg)),
    };

    service = new ApiKeyService(mockFastify, {} as any);
  });

  describe('createApiKey', () => {
    it('should create API key with multiple models', async () => {
      const userId = 'user-123';
      const request = {
        modelIds: ['gpt-4', 'gpt-3.5-turbo', 'claude-3'],
        name: 'Multi-Model Key',
      };

      // Mock validations
      mockFastify.dbUtils.query.mockResolvedValueOnce([
        { model_id: 'gpt-4' },
        { model_id: 'gpt-3.5-turbo' },
        { model_id: 'claude-3' },
      ]);

      mockFastify.dbUtils.queryOne.mockResolvedValueOnce({ count: '2' });

      // Mock LiteLLM response
      const mockLiteLLMService = {
        generateApiKey: vi.fn().mockResolvedValue({
          key: 'sk-litellm-123',
          key_name: 'Multi-Model Key',
        }),
      };
      (service as any).liteLLMService = mockLiteLLMService;

      // Mock database operations
      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({
            // INSERT api_keys
            rows: [{ id: 'key-123', name: 'Multi-Model Key' }],
          })
          .mockResolvedValueOnce(undefined) // INSERT api_key_models (1)
          .mockResolvedValueOnce(undefined) // INSERT api_key_models (2)
          .mockResolvedValueOnce(undefined) // INSERT api_key_models (3)
          .mockResolvedValueOnce(undefined) // INSERT audit_logs
          .mockResolvedValueOnce(undefined), // COMMIT
        release: vi.fn(),
      };
      mockFastify.pg.connect.mockResolvedValueOnce(mockClient);

      const result = await service.createApiKey(userId, request);

      expect(result).toMatchObject({
        models: ['gpt-4', 'gpt-3.5-turbo', 'claude-3'],
        name: 'Multi-Model Key',
      });

      expect(mockLiteLLMService.generateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          models: ['gpt-4', 'gpt-3.5-turbo', 'claude-3'],
        }),
      );
    });

    it('should handle legacy subscriptionId requests', async () => {
      const userId = 'user-123';
      const request = {
        subscriptionId: 'sub-123',
        name: 'Legacy Key',
      };

      // Mock subscription lookup
      mockFastify.dbUtils.queryOne.mockResolvedValueOnce({
        model_id: 'gpt-4',
        status: 'active',
      });

      // Mock validation
      mockFastify.dbUtils.query.mockResolvedValueOnce([{ model_id: 'gpt-4' }]);
      mockFastify.dbUtils.queryOne.mockResolvedValueOnce({ count: '0' });

      // ... rest of mocks

      const result = await service.createApiKey(userId, request);

      expect(mockFastify.log.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('deprecated'),
        }),
      );
    });

    it('should validate user has subscriptions for all models', async () => {
      const userId = 'user-123';
      const request = {
        modelIds: ['gpt-4', 'unauthorized-model'],
        name: 'Invalid Key',
      };

      // Mock validation - only one model is authorized
      mockFastify.dbUtils.query.mockResolvedValueOnce([{ model_id: 'gpt-4' }]);

      await expect(service.createApiKey(userId, request)).rejects.toThrow(
        'You do not have active subscriptions for the following models: unauthorized-model',
      );
    });
  });

  describe('getUserApiKeys', () => {
    it('should return API keys with associated models', async () => {
      const userId = 'user-123';

      mockFastify.dbUtils.query.mockResolvedValueOnce([
        {
          id: 'key-1',
          name: 'Multi-Model Key',
          models: ['gpt-4', 'gpt-3.5-turbo'],
          model_details: [
            { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
          ],
        },
        {
          id: 'key-2',
          name: 'Single Model Key',
          models: ['claude-3'],
          model_details: [{ id: 'claude-3', name: 'Claude 3', provider: 'anthropic' }],
        },
      ]);

      const result = await service.getUserApiKeys(userId);

      expect(result).toHaveLength(2);
      expect(result[0].models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
      expect(result[1].models).toEqual(['claude-3']);
    });

    it('should handle backward compatibility for keys without models', async () => {
      const userId = 'user-123';

      mockFastify.dbUtils.query.mockResolvedValueOnce([
        {
          id: 'legacy-key',
          name: 'Legacy Key',
          models: null,
          model_details: null,
          subscription_id: 'sub-123',
        },
      ]);

      mockFastify.dbUtils.queryOne.mockResolvedValueOnce({
        model_id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
      });

      const result = await service.getUserApiKeys(userId);

      expect(result[0].models).toEqual(['gpt-4']);
    });
  });
});
```

#### 4.2 Integration Tests

Create test file: `backend/tests/integration/routes/api-keys-multi-model.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app';

describe('API Keys Routes - Multi-Model Support', () => {
  let app: FastifyInstance;
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    // Create test user and get auth token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'testuser',
        password: 'testpass',
      },
    });

    const { accessToken, user } = JSON.parse(loginResponse.body);
    authToken = accessToken;
    userId = user.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/api-keys', () => {
    it('should create API key with multiple models', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          modelIds: ['gpt-4', 'gpt-3.5-turbo'],
          name: 'Test Multi-Model Key',
          maxBudget: 100,
          rpmLimit: 1000,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
      expect(body.name).toBe('Test Multi-Model Key');
      expect(body.key).toMatch(/^sk-lm-/);
    });

    it('should accept legacy subscriptionId for backward compatibility', async () => {
      // First create a subscription
      const subResponse = await app.inject({
        method: 'POST',
        url: '/api/subscriptions',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          modelId: 'gpt-4',
          tier: 'basic',
        },
      });

      const subscription = JSON.parse(subResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          subscriptionId: subscription.id,
          name: 'Legacy Format Key',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.models).toEqual(['gpt-4']);
    });

    it('should reject request with no models', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          modelIds: [],
          name: 'Invalid Key',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('minItems');
    });

    it('should reject request for unauthorized models', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          modelIds: ['unauthorized-model'],
          name: 'Unauthorized Key',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('do not have active subscriptions');
    });
  });

  describe('GET /api/api-keys', () => {
    it('should return API keys with model information', async () => {
      // Create a key first
      await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          modelIds: ['gpt-4', 'claude-3'],
          name: 'Multi-Model Key',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/api-keys',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data[0].models).toContain('gpt-4');
      expect(body.data[0].models).toContain('claude-3');
      expect(body.data[0].modelDetails).toBeInstanceOf(Array);
    });
  });
});
```

### Phase 5: Migration and Rollback Plan

#### 5.1 Migration Steps

1. **Deploy database changes**
   - Create junction table
   - Make subscription_id nullable
   - Run data migration

2. **Deploy backend with backward compatibility**
   - Both old and new formats work
   - Monitor for deprecation warnings

3. **Deploy frontend changes**
   - New UI with model selection
   - Test thoroughly

4. **Monitor and validate**
   - Check all API keys work
   - Monitor LiteLLM integration
   - Track usage patterns

5. **Clean up (after validation period)**
   - Drop subscription_id column
   - Remove legacy code paths

#### 5.2 Rollback Plan

If issues arise:

1. **Frontend rollback**
   - Revert to subscription-based UI
   - No data changes needed

2. **Backend rollback**
   - Keep backward compatibility code
   - Legacy format continues to work

3. **Database rollback**
   - Junction table can remain (no harm)
   - Restore subscription_id NOT NULL if needed

### Phase 6: Documentation Updates

#### 6.1 Update API Documentation

Update `docs/api/api-keys.md`:

````markdown
# API Keys API

## Overview

The API Keys API allows users to create and manage API keys for accessing LiteMaaS services.
Each API key can be associated with multiple models, allowing flexible access control.

## Changes in v2.0

- **Multi-Model Support**: API keys can now be associated with multiple models
- **Backward Compatibility**: The legacy `subscriptionId` parameter is still supported but deprecated
- **Improved Flexibility**: Users can select specific models they want to access with each key

## Endpoints

### Create API Key

Create a new API key associated with one or more models.

**Endpoint**: `POST /api/api-keys`

**Request Body**:

```json
{
  "modelIds": ["gpt-4", "gpt-3.5-turbo", "claude-3"],
  "name": "Production API Key",
  "expiresAt": "2024-12-31T23:59:59Z",
  "maxBudget": 1000,
  "budgetDuration": "monthly",
  "tpmLimit": 100000,
  "rpmLimit": 1000,
  "metadata": {
    "environment": "production",
    "team": "backend"
  }
}
```
````

**Legacy Format** (deprecated):

```json
{
  "subscriptionId": "sub-123",
  "name": "Legacy API Key"
}
```

**Response**:

```json
{
  "id": "key-123",
  "models": ["gpt-4", "gpt-3.5-turbo", "claude-3"],
  "modelDetails": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "contextLength": 8192
    },
    {
      "id": "gpt-3.5-turbo",
      "name": "GPT-3.5 Turbo",
      "provider": "openai",
      "contextLength": 4096
    },
    {
      "id": "claude-3",
      "name": "Claude 3",
      "provider": "anthropic",
      "contextLength": 100000
    }
  ],
  "name": "Production API Key",
  "keyPrefix": "sk-lm-",
  "key": "sk-lm-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "expiresAt": "2024-12-31T23:59:59Z",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "liteLLMInfo": {
    "key_name": "Production API Key",
    "max_budget": 1000,
    "current_spend": 0,
    "models": ["gpt-4", "gpt-3.5-turbo", "claude-3"],
    "tpm_limit": 100000,
    "rpm_limit": 1000
  }
}
```

### Get User's API Keys

**Endpoint**: `GET /api/api-keys`

**Response**:

```json
{
  "data": [
    {
      "id": "key-123",
      "models": ["gpt-4", "gpt-3.5-turbo"],
      "modelDetails": [...],
      "name": "Production Key",
      "keyPrefix": "sk-lm-",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastUsedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

## Migration Guide

### For API Consumers

1. **Update your API key creation calls** to use `modelIds` instead of `subscriptionId`
2. **Handle multiple models** in the response
3. **Update your UI** to show associated models

### Example Migration

**Before**:

```javascript
const response = await fetch('/api/api-keys', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    subscriptionId: 'sub-123',
    name: 'My API Key',
  }),
});
```

**After**:

```javascript
const response = await fetch('/api/api-keys', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    modelIds: ['gpt-4', 'gpt-3.5-turbo'],
    name: 'My API Key',
  }),
});
```

````

#### 6.2 Update Architecture Documentation

Update `docs/architecture/database-schema.md` to reflect the new many-to-many relationship and junction table.

### Conclusion

This implementation guide provides a complete roadmap for adding multi-model support to API keys in LiteMaaS. The changes maintain backward compatibility while providing users with the flexibility to use a single API key across multiple models, aligning with LiteLLM's native capabilities and improving the user experience.

The implementation is designed to be rolled out in phases, with careful attention to data migration, testing, and rollback procedures. Following this guide will ensure a smooth transition to the new multi-model API key system.

## Key Alias Uniqueness Implementation

### Problem Statement

LiteLLM requires the `key_alias` field to be globally unique across all users and keys in the system. However, LiteMaaS only enforces key name uniqueness within each user's account. This mismatch causes conflicts when different users try to create API keys with the same name (e.g., "production-key").

### Solution: UUID-based Suffix

To ensure global uniqueness while preserving user-friendly names, we append an 8-character UUID suffix to each key alias.

#### Implementation Details

1. **Method**: Added `generateUniqueKeyAlias(baseName: string)` to both ApiKeyService and SubscriptionService
2. **Format**: `${sanitizedName}_${uuid}`
   - Example: `production-key_a5f2b1c3`
3. **Sanitization Rules**:
   - Replace non-alphanumeric characters (except `-` and `_`) with hyphens
   - Collapse multiple consecutive hyphens to single hyphen
   - Remove leading/trailing hyphens
   - Truncate to 50 characters maximum
   - Default to "api-key" or "subscription" if name becomes empty after sanitization

#### Code Example

```typescript
private generateUniqueKeyAlias(baseName: string): string {
  // Generate a short UUID suffix (8 characters) for uniqueness
  const uuid = randomBytes(4).toString('hex'); // 4 bytes = 8 hex characters

  // Sanitize the base name to remove any problematic characters
  const sanitizedName = baseName
    .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length to keep alias reasonable

  // Return the unique alias
  return `${sanitizedName || 'api-key'}_${uuid}`;
}
````

#### Usage in API Key Creation

```typescript
// In ApiKeyService.createApiKey()
const liteLLMRequest: LiteLLMKeyGenerationRequest = {
  key_alias: this.generateUniqueKeyAlias(request.name || 'api-key'),
  // ... other fields
};

// In SubscriptionService.createEnhancedSubscription()
const keyRequest: LiteLLMKeyGenerationRequest = {
  key_alias: this.generateUniqueKeyAlias(
    apiKeyAlias || `subscription-${baseSubscription.id.substring(0, 8)}`,
  ),
  // ... other fields
};
```

### Benefits

1. **No Conflicts**: UUID suffix guarantees global uniqueness
2. **User-Friendly**: Original name is preserved in LiteMaaS UI (stored in `name` field)
3. **Privacy**: No user information (ID, email, etc.) exposed in LiteLLM
4. **Backward Compatible**: Existing keys continue to work
5. **Simple Implementation**: Minimal code changes required
6. **Predictable Format**: Easy to identify LiteMaaS keys in LiteLLM dashboard

### Examples

| User Input           | Generated key_alias                                           | Notes                    |
| -------------------- | ------------------------------------------------------------- | ------------------------ |
| `production-key`     | `production-key_a5f2b1c3`                                     | Standard case            |
| `my@special#key!`    | `my-special-key_f71c5769`                                     | Special chars sanitized  |
| `test key (main)`    | `test-key-main_abf867a7`                                      | Spaces replaced          |
| ` ` (empty)          | `api-key_66532322`                                            | Default fallback         |
| `@#$%^&*()`          | `api-key_e2daa9b6`                                            | All invalid chars        |
| Long name (95 chars) | `this-is-a-very-long-api-key-name-that-exceeds-the-_0e70476c` | Truncated to 50 + suffix |

### Alternatives Considered

1. **User ID Prefix**: `user_${userId}_${keyName}` - Rejected due to privacy concerns
2. **Email Prefix**: `${email}_${keyName}` - Rejected due to privacy and mutability
3. **Full UUID**: Replace name entirely - Rejected as not user-friendly
4. **Timestamp**: `${keyName}_${timestamp}` - Rejected as not guaranteed unique

The UUID suffix approach provides the best balance of uniqueness, privacy, and usability.
