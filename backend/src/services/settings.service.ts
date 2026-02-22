import { FastifyInstance } from 'fastify';
import { BaseService } from './base.service';
import { ApiKeyQuotaDefaults } from '../types/api-key.types';

const EMPTY_DEFAULTS: ApiKeyQuotaDefaults = {
  defaults: {
    maxBudget: null,
    tpmLimit: null,
    rpmLimit: null,
    budgetDuration: null,
    softBudget: null,
  },
  maximums: {
    maxBudget: null,
    tpmLimit: null,
    rpmLimit: null,
  },
};

export class SettingsService extends BaseService {
  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  /**
   * Get API key quota defaults and maximums
   */
  async getApiKeyDefaults(): Promise<ApiKeyQuotaDefaults> {
    const result = await this.fastify.dbUtils.queryOne<{
      value: ApiKeyQuotaDefaults;
    }>(
      `SELECT value FROM system_settings WHERE key = 'api_key_defaults'`,
      [],
    );

    if (!result?.value || Object.keys(result.value).length === 0) {
      return EMPTY_DEFAULTS;
    }

    // Merge with empty defaults to ensure all fields exist
    return {
      defaults: {
        ...EMPTY_DEFAULTS.defaults,
        ...(result.value.defaults ?? {}),
      },
      maximums: {
        ...EMPTY_DEFAULTS.maximums,
        ...(result.value.maximums ?? {}),
      },
    };
  }

  /**
   * Update API key quota defaults and maximums
   */
  async updateApiKeyDefaults(
    adminUserId: string,
    settings: ApiKeyQuotaDefaults,
  ): Promise<ApiKeyQuotaDefaults> {
    // Validate that defaults don't exceed maximums
    const { defaults, maximums } = settings;

    if (maximums.maxBudget != null && defaults.maxBudget != null && defaults.maxBudget > maximums.maxBudget) {
      throw this.fastify.createError(400, 'Default max budget cannot exceed the maximum limit');
    }
    if (maximums.tpmLimit != null && defaults.tpmLimit != null && defaults.tpmLimit > maximums.tpmLimit) {
      throw this.fastify.createError(400, 'Default TPM limit cannot exceed the maximum limit');
    }
    if (maximums.rpmLimit != null && defaults.rpmLimit != null && defaults.rpmLimit > maximums.rpmLimit) {
      throw this.fastify.createError(400, 'Default RPM limit cannot exceed the maximum limit');
    }

    const result = await this.fastify.dbUtils.queryOne<{
      value: ApiKeyQuotaDefaults;
    }>(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ('api_key_defaults', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET
         value = $1,
         updated_at = NOW(),
         updated_by = $2
       RETURNING value`,
      [JSON.stringify(settings), adminUserId],
    );

    // Audit log
    await this.fastify.dbUtils.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminUserId,
        'UPDATE_API_KEY_DEFAULTS',
        'SYSTEM_SETTINGS',
        'api_key_defaults',
        JSON.stringify({ settings }),
      ],
    );

    return result?.value ?? settings;
  }
}
