/**
 * Complete LiteMaaS Database Schema
 * All tables required for the application functionality
 */

import { DatabaseUtils } from '../types/common.types';

// Get default values from environment or use hardcoded fallbacks
const getDefaultUserMaxBudget = () => process.env.DEFAULT_USER_MAX_BUDGET || '100.00';
const getDefaultUserTPMLimit = () => process.env.DEFAULT_USER_TPM_LIMIT || '10000';
const getDefaultUserRPMLimit = () => process.env.DEFAULT_USER_RPM_LIMIT || '60';

// Users table
export const usersTable = `
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    oauth_provider VARCHAR(50) NOT NULL,
    oauth_id VARCHAR(255) NOT NULL,
    roles TEXT[] DEFAULT ARRAY['user'],
    is_active BOOLEAN DEFAULT true,
    max_budget DECIMAL(10,2) DEFAULT ${getDefaultUserMaxBudget()},
    tpm_limit INTEGER DEFAULT ${getDefaultUserTPMLimit()},
    rpm_limit INTEGER DEFAULT ${getDefaultUserRPMLimit()},
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(oauth_provider, oauth_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

-- Add missing columns for existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_budget DECIMAL(10,2) DEFAULT ${getDefaultUserMaxBudget()};
ALTER TABLE users ADD COLUMN IF NOT EXISTS tpm_limit INTEGER DEFAULT ${getDefaultUserTPMLimit()};
ALTER TABLE users ADD COLUMN IF NOT EXISTS rpm_limit INTEGER DEFAULT ${getDefaultUserRPMLimit()};
ALTER TABLE users ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'pending';

-- Drop lite_llm_user_id column if it exists (no longer needed as id is used directly)
ALTER TABLE users DROP COLUMN IF EXISTS lite_llm_user_id;

-- Add constraint after column exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_sync_status_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_sync_status_check CHECK (sync_status IN ('pending', 'synced', 'error'));
    END IF;
END $$;
`;

// System user for automated status changes
export const systemUserSetup = `
-- Create system user with fixed UUID for audit trail
INSERT INTO users (
  id,
  username,
  email,
  oauth_provider,
  oauth_id,
  is_active,
  roles
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system',
  'system@litemaas.internal',
  'system',
  'system',
  false,  -- System user cannot log in
  '{}'    -- No roles needed
) ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN users.id IS 'System user (00000000-0000-0000-0000-000000000001) used for automated status changes in subscription approval workflow';
`;

// Teams table
export const teamsTable = `
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    alias VARCHAR(255),
    description TEXT,
    lite_llm_team_id VARCHAR(255),
    max_budget DECIMAL(10,2),
    current_spend DECIMAL(10,2) DEFAULT 0,
    budget_duration VARCHAR(20) DEFAULT 'monthly',
    tpm_limit INTEGER,
    rpm_limit INTEGER,
    allowed_models TEXT[],
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);
CREATE INDEX IF NOT EXISTS idx_teams_alias ON teams(alias);
CREATE INDEX IF NOT EXISTS idx_teams_lite_llm ON teams(lite_llm_team_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
`;

// Team members junction table
export const teamMembersTable = `
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    added_by UUID REFERENCES users(id),
    UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
`;

// Models table
export const modelsTable = `
CREATE TABLE IF NOT EXISTS models (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    context_length INTEGER,
    input_cost_per_token DECIMAL(15,10),
    output_cost_per_token DECIMAL(15,10),
    supports_vision BOOLEAN DEFAULT false,
    supports_function_calling BOOLEAN DEFAULT false,
    supports_tool_choice BOOLEAN DEFAULT false,
    supports_parallel_function_calling BOOLEAN DEFAULT false,
    supports_streaming BOOLEAN DEFAULT true,
    features TEXT[],
    availability VARCHAR(50) DEFAULT 'available',
    version VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    -- Admin-specific fields extracted from LiteLLM
    api_base VARCHAR(500),
    tpm INTEGER,
    rpm INTEGER,
    max_tokens INTEGER,
    litellm_model_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add missing admin columns for existing tables
ALTER TABLE models ADD COLUMN IF NOT EXISTS api_base VARCHAR(500);
ALTER TABLE models ADD COLUMN IF NOT EXISTS tpm INTEGER;
ALTER TABLE models ADD COLUMN IF NOT EXISTS rpm INTEGER;
ALTER TABLE models ADD COLUMN IF NOT EXISTS max_tokens INTEGER;
ALTER TABLE models ADD COLUMN IF NOT EXISTS litellm_model_id VARCHAR(255);
ALTER TABLE models ADD COLUMN IF NOT EXISTS backend_model_name VARCHAR(255);

-- Add restricted_access column for subscription approval workflow
ALTER TABLE models ADD COLUMN IF NOT EXISTS restricted_access BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
CREATE INDEX IF NOT EXISTS idx_models_category ON models(category);
CREATE INDEX IF NOT EXISTS idx_models_availability ON models(availability);
CREATE INDEX IF NOT EXISTS idx_models_litellm_model_id ON models(litellm_model_id);
CREATE INDEX IF NOT EXISTS idx_models_restricted_access ON models(restricted_access);

COMMENT ON COLUMN models.restricted_access IS 'When true, subscriptions require admin approval';
`;

// Subscriptions table
export const subscriptionsTable = `
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id),
    team_id UUID REFERENCES teams(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'expired', 'inactive')),
    quota_requests INTEGER NOT NULL DEFAULT 0,
    quota_tokens INTEGER NOT NULL DEFAULT 0,
    used_requests INTEGER DEFAULT 0,
    used_tokens INTEGER DEFAULT 0,
    max_budget DECIMAL(10,2),
    current_spend DECIMAL(10,2) DEFAULT 0,
    budget_duration VARCHAR(20) DEFAULT 'monthly',
    tpm_limit INTEGER,
    rpm_limit INTEGER,
    allowed_models TEXT[],
    lite_llm_key_value VARCHAR(255),
    reset_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'error')),
    sync_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_model_subscription UNIQUE (user_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_model_id ON subscriptions(model_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_team_id ON subscriptions(team_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_model ON subscriptions(user_id, model_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_lite_llm_key_value ON subscriptions(lite_llm_key_value);

COMMENT ON COLUMN subscriptions.lite_llm_key_value IS 'The actual LiteLLM key value for this subscription';
`;

// Migration to update subscriptions status constraint to include 'inactive', 'pending', and 'denied'
export const updateSubscriptionsStatusConstraint = `
-- Drop existing constraint if it exists
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;

-- Add updated constraint with 'inactive', 'pending', and 'denied' statuses
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
CHECK (status IN ('active', 'suspended', 'cancelled', 'expired', 'inactive', 'pending', 'denied'));

-- Add new columns for subscription approval workflow
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES users(id);

-- Add composite index for admin panel queries (status + timestamp for sorting)
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_updated
  ON subscriptions(status, status_changed_at DESC);

COMMENT ON COLUMN subscriptions.status_reason IS 'Admin comment when approving/denying subscription';
COMMENT ON COLUMN subscriptions.status_changed_at IS 'Timestamp of last status change';
COMMENT ON COLUMN subscriptions.status_changed_by IS 'User ID of admin who changed status (or system user UUID for automated changes)';
`;

// API Keys table
export const apiKeysTable = `
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,  -- Nullable for multi-model support
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    lite_llm_key_value VARCHAR(255),
    permissions JSONB DEFAULT '{}',
    max_budget DECIMAL(10,2),
    current_spend DECIMAL(10,2) DEFAULT 0,
    tpm_limit INTEGER,
    rpm_limit INTEGER,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'error')),
    sync_error TEXT,
    migration_status VARCHAR(20) DEFAULT 'pending'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_subscription_id ON api_keys(subscription_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_lite_llm_key_value ON api_keys(lite_llm_key_value);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

COMMENT ON COLUMN api_keys.lite_llm_key_value IS 'The actual LiteLLM key value for this API key';

-- Add missing updated_at column for existing api_keys table
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add litellm_key_alias column for matching usage data to our API keys
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS litellm_key_alias VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_api_keys_litellm_key_alias ON api_keys(litellm_key_alias);

COMMENT ON COLUMN api_keys.litellm_key_alias IS 'The key_alias from LiteLLM used to match usage analytics data';

-- Per-key budget and limit fields
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS budget_duration VARCHAR(20);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS soft_budget DECIMAL(10,2);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS budget_reset_at TIMESTAMP WITH TIME ZONE;

-- Phase 3: Advanced per-key limits
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS max_parallel_requests INTEGER;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS model_max_budget JSONB;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS model_rpm_limit JSONB;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS model_tpm_limit JSONB;
`;

// API Key Models junction table
export const apiKeyModelsTable = `
CREATE TABLE IF NOT EXISTS api_key_models (
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (api_key_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_api_key_models_api_key ON api_key_models(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_models_model ON api_key_models(model_id);

COMMENT ON TABLE api_key_models IS 'Junction table linking API keys to multiple models';
`;

// Audit logs table
export const auditLogsTable = `
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
`;

// Refresh tokens table
export const refreshTokensTable = `
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked_at ON refresh_tokens(revoked_at);
`;

// OAuth sessions table
export const oauthSessionsTable = `
CREATE TABLE IF NOT EXISTS oauth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state VARCHAR(255) UNIQUE NOT NULL,
    code_verifier VARCHAR(255),
    redirect_uri VARCHAR(500),
    nonce VARCHAR(255),
    user_id UUID REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON oauth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_id ON oauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);
`;

// Banner announcements table
export const bannerAnnouncementsTable = `
CREATE TABLE IF NOT EXISTS banner_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core fields
    name VARCHAR(100) NOT NULL DEFAULT 'Untitled Banner',
    is_active BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 0,
    
    -- Content (JSON for i18n support)
    content JSONB NOT NULL DEFAULT '{}',
    
    -- Styling and behavior
    variant VARCHAR(20) DEFAULT 'info' 
        CHECK (variant IN ('info', 'warning', 'danger', 'success', 'default')),
    is_dismissible BOOLEAN DEFAULT false,
    dismiss_duration_hours INTEGER,
    
    -- Scheduling (for future enhancement)
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    
    -- Targeting (for future enhancement)
    target_roles TEXT[],
    target_user_ids UUID[],
    
    -- Rich content support
    link_url VARCHAR(500),
    link_text JSONB,
    markdown_enabled BOOLEAN DEFAULT false,
    
    -- Audit fields
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add name column for existing tables (migration for backward compatibility)
ALTER TABLE banner_announcements ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'Untitled Banner';

CREATE INDEX IF NOT EXISTS idx_banner_active ON banner_announcements(is_active, priority DESC)
    WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_banner_created_by ON banner_announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_banner_updated_by ON banner_announcements(updated_by);
CREATE INDEX IF NOT EXISTS idx_banner_name ON banner_announcements(name);
`;

// User banner dismissals table
export const userBannerDismissalsTable = `
CREATE TABLE IF NOT EXISTS user_banner_dismissals (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    banner_id UUID REFERENCES banner_announcements(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, banner_id)
);

CREATE INDEX IF NOT EXISTS idx_user_banner_dismissals_user_id ON user_banner_dismissals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_banner_dismissals_banner_id ON user_banner_dismissals(banner_id);
`;

// Banner audit log table
export const bannerAuditLogTable = `
CREATE TABLE IF NOT EXISTS banner_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    banner_id UUID REFERENCES banner_announcements(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete', 'activate', 'deactivate'
    changed_by UUID REFERENCES users(id),
    previous_state JSONB,
    new_state JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_banner_audit_log_banner_id ON banner_audit_log(banner_id);
CREATE INDEX IF NOT EXISTS idx_banner_audit_log_changed_by ON banner_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_banner_audit_log_changed_at ON banner_audit_log(changed_at);
`;

// Subscription status history table for approval workflow audit trail
export const subscriptionStatusHistoryTable = `
CREATE TABLE IF NOT EXISTS subscription_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    reason TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription_id
  ON subscription_status_history(subscription_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_history_changed_by
  ON subscription_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_subscription_history_changed_at
  ON subscription_status_history(changed_at DESC);

COMMENT ON TABLE subscription_status_history IS 'Audit trail for all subscription status changes';
`;

// Updated triggers for updated_at columns
export const updatedAtTriggers = `
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_models_updated_at ON models;
CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_banner_announcements_updated_at ON banner_announcements;
CREATE TRIGGER update_banner_announcements_updated_at BEFORE UPDATE ON banner_announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

// Default team creation
export const defaultTeamMigration = `
-- Create default team for all users (idempotent)
INSERT INTO teams (
    id, 
    name, 
    alias, 
    description, 
    max_budget, 
    current_spend, 
    budget_duration, 
    tpm_limit, 
    rpm_limit, 
    allowed_models, 
    metadata, 
    is_active, 
    created_at, 
    updated_at
) VALUES (
    'a0000000-0000-4000-8000-000000000001'::UUID,
    'Default Team',
    'default-team',
    'Default team for all users until team management is implemented',
    10000.00,
    0,
    'monthly',
    50000,
    1000,
    ARRAY[]::TEXT[],
    '{"auto_created": true, "default_team": true, "created_by": "system"}',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    alias = EXCLUDED.alias,
    description = EXCLUDED.description,
    max_budget = EXCLUDED.max_budget,
    tpm_limit = EXCLUDED.tpm_limit,
    rpm_limit = EXCLUDED.rpm_limit,
    allowed_models = EXCLUDED.allowed_models,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Assign all existing users to default team who aren't already in a team
INSERT INTO team_members (team_id, user_id, role, joined_at, added_by)
SELECT 
    'a0000000-0000-4000-8000-000000000001'::UUID,
    u.id,
    'member',
    NOW(),
    NULL -- System assignment
FROM users u
WHERE u.id NOT IN (
    SELECT DISTINCT user_id 
    FROM team_members 
    WHERE team_id = '00000000-0000-0000-0000-000000000001'::UUID
)
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_members_default_team ON team_members(team_id) WHERE team_id = '00000000-0000-0000-0000-000000000001'::UUID;
`;

// Populate litellm_model_id from metadata migration
export const litellmModelIdMigration = `
-- Populate litellm_model_id column from existing metadata for models that don't have it set
UPDATE models
SET litellm_model_id = metadata->'litellm_model_info'->>'id'
WHERE litellm_model_id IS NULL
  AND metadata->'litellm_model_info'->>'id' IS NOT NULL
  AND metadata->'litellm_model_info'->>'id' != '';

-- Log the migration results
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Populated litellm_model_id for % models from metadata', updated_count;
END $$;
`;

// Fix key_hash to store hash of actual LiteLLM key value
export const fixKeyHashMigration = `
-- Enable pgcrypto extension for digest() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update key_hash to be the SHA256 hash of lite_llm_key_value (the actual LiteLLM key)
-- This fixes a bug where key_hash was storing the hash of a random local key
-- that was never used, breaking API key authentication
UPDATE api_keys
SET key_hash = encode(digest(lite_llm_key_value::bytea, 'sha256'::text), 'hex')
WHERE lite_llm_key_value IS NOT NULL
  AND key_hash != encode(digest(lite_llm_key_value::bytea, 'sha256'::text), 'hex');

-- Log the migration results
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM api_keys
    WHERE lite_llm_key_value IS NOT NULL;

    RAISE NOTICE 'Fixed key_hash values for API keys (total active keys with LiteLLM value: %)', updated_count;
END $$;
`;

// Migrate existing subscriptions to new approval workflow schema
export const migrateExistingSubscriptions = `
-- Set default values for existing subscriptions
UPDATE subscriptions
SET
  status_reason = NULL,
  status_changed_at = COALESCE(updated_at, created_at),  -- Use existing updated_at or created_at timestamp
  status_changed_by = '00000000-0000-0000-0000-000000000001'  -- System user
WHERE status_changed_at IS NULL;

-- Set all existing models to non-restricted (default behavior)
UPDATE models
SET restricted_access = false
WHERE restricted_access IS NULL;

-- Log the migration results
DO $$
DECLARE
    subscription_count INTEGER;
    model_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO subscription_count
    FROM subscriptions
    WHERE status_changed_by = '00000000-0000-0000-0000-000000000001';

    SELECT COUNT(*) INTO model_count
    FROM models
    WHERE restricted_access = false;

    RAISE NOTICE 'Migrated % existing subscriptions with system user attribution', subscription_count;
    RAISE NOTICE 'Set % models to non-restricted access (default)', model_count;
END $$;

COMMENT ON COLUMN subscriptions.status_changed_by IS 'Existing subscriptions migrated with system user ID (00000000-0000-0000-0000-000000000001)';
`;

// Function to backfill litellm_key_alias for existing API keys
// This is called programmatically at startup after the tables are created
export const backfillLiteLLMKeyAlias = async (dbUtils: DatabaseUtils, liteLLMService: any) => {
  try {
    // Find all API keys that don't have litellm_key_alias set
    // Only process active keys to avoid 404s from inactive/revoked keys
    const keysToBackfill = await dbUtils.queryMany<{
      id: string;
      lite_llm_key_value: string;
    }>(
      `SELECT id, lite_llm_key_value
       FROM api_keys
       WHERE litellm_key_alias IS NULL
         AND lite_llm_key_value IS NOT NULL
         AND is_active = true`,
      [],
    );

    if (keysToBackfill.length === 0) {
      console.log('✅ No API keys need litellm_key_alias backfill');
      return;
    }

    console.log(`🔄 Backfilling litellm_key_alias for ${keysToBackfill.length} API keys...`);

    let successCount = 0;
    let orphanedCount = 0;
    let errorCount = 0;

    for (const key of keysToBackfill) {
      try {
        // Call LiteLLM /key/info to get the key_alias
        const keyInfo = await liteLLMService.getKeyAlias(key.lite_llm_key_value);

        // Update the database with the key_alias
        await dbUtils.query(`UPDATE api_keys SET litellm_key_alias = $1 WHERE id = $2`, [
          keyInfo.key_alias,
          key.id,
        ]);

        successCount++;
      } catch (error) {
        // Handle 404s (orphaned keys) differently - mark without verbose logging
        if (error instanceof Error && error.message?.includes('404')) {
          await dbUtils.query(`UPDATE api_keys SET litellm_key_alias = $1 WHERE id = $2`, [
            `orphaned_${key.id}`,
            key.id,
          ]);
          orphanedCount++;
        } else {
          console.error(
            `Failed to backfill key_alias for API key ${key.id}:`,
            error instanceof Error ? error.message : error,
          );
          errorCount++;
        }
      }
    }

    console.log(
      `✅ Backfilled litellm_key_alias: ${successCount} succeeded, ${orphanedCount} orphaned, ${errorCount} failed`,
    );
  } catch (error) {
    console.error('❌ Failed to backfill litellm_key_alias:', error);
    // Don't throw - this is a best-effort migration
  }
};

// Daily usage cache table for admin usage analytics
export const dailyUsageCacheTable = `
CREATE TABLE IF NOT EXISTS daily_usage_cache (
    date DATE PRIMARY KEY,
    raw_data JSONB NOT NULL,              -- Full LiteLLM response for the day
    aggregated_by_user JSONB,             -- Pre-computed user breakdown
    aggregated_by_model JSONB,            -- Pre-computed model breakdown
    aggregated_by_provider JSONB,         -- Pre-computed provider breakdown
    total_metrics JSONB,                  -- Pre-computed totals (requests, tokens, cost, etc.)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_complete BOOLEAN DEFAULT true      -- false if current day (needs periodic refresh)
);

CREATE INDEX IF NOT EXISTS idx_daily_cache_date ON daily_usage_cache(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_cache_complete ON daily_usage_cache(is_complete);
CREATE INDEX IF NOT EXISTS idx_daily_cache_updated_at ON daily_usage_cache(updated_at) WHERE is_complete = false;

COMMENT ON TABLE daily_usage_cache IS 'Cached daily usage data from LiteLLM for admin analytics with 5-minute TTL for current day';
COMMENT ON COLUMN daily_usage_cache.date IS 'The date for which usage data is cached';
COMMENT ON COLUMN daily_usage_cache.raw_data IS 'Full LiteLLM API response for the day';
COMMENT ON COLUMN daily_usage_cache.is_complete IS 'False for current day (needs refresh), true for historical days (permanent cache)';

-- Add index on api_keys.lite_llm_key_value if it doesn't exist (needed for user mapping from LiteLLM data)
CREATE INDEX IF NOT EXISTS idx_api_keys_lite_llm_key ON api_keys(lite_llm_key_value);
`;

// Main migration function
export const applyMigrations = async (dbUtils: DatabaseUtils) => {
  console.log('🚀 Starting database migrations...');

  try {
    // Apply all table creations in order (respecting foreign key dependencies)
    console.log('📊 Creating users table...');
    await dbUtils.query(usersTable);

    console.log('🤖 Creating system user for audit trail...');
    await dbUtils.query(systemUserSetup);

    console.log('👥 Creating teams table...');
    await dbUtils.query(teamsTable);

    console.log('🔗 Creating team_members table...');
    await dbUtils.query(teamMembersTable);

    console.log('🤖 Creating models table...');
    await dbUtils.query(modelsTable);

    console.log('📝 Creating subscriptions table...');
    await dbUtils.query(subscriptionsTable);

    console.log('🔄 Updating subscriptions status constraint...');
    await dbUtils.query(updateSubscriptionsStatusConstraint);

    console.log('🔑 Creating api_keys table...');
    await dbUtils.query(apiKeysTable);

    console.log('🔑 Creating api_key_models table...');
    await dbUtils.query(apiKeyModelsTable);

    console.log('📋 Creating audit_logs table...');
    await dbUtils.query(auditLogsTable);

    console.log('🔄 Creating refresh_tokens table...');
    await dbUtils.query(refreshTokensTable);

    console.log('🔐 Creating oauth_sessions table...');
    await dbUtils.query(oauthSessionsTable);

    console.log('📢 Creating banner_announcements table...');
    await dbUtils.query(bannerAnnouncementsTable);

    console.log('🚫 Creating user_banner_dismissals table...');
    await dbUtils.query(userBannerDismissalsTable);

    console.log('📝 Creating banner_audit_log table...');
    await dbUtils.query(bannerAuditLogTable);

    console.log('📋 Creating subscription_status_history table...');
    await dbUtils.query(subscriptionStatusHistoryTable);

    console.log('⚡ Creating triggers...');
    await dbUtils.query(updatedAtTriggers);

    console.log('👥 Creating default team and assigning users...');
    await dbUtils.query(defaultTeamMigration);

    console.log('🔧 Populating litellm_model_id from metadata...');
    await dbUtils.query(litellmModelIdMigration);

    console.log('📊 Creating daily_usage_cache table...');
    await dbUtils.query(dailyUsageCacheTable);

    console.log('🔐 Fixing key_hash values for API key authentication...');
    await dbUtils.query(fixKeyHashMigration);

    console.log('🔄 Migrating existing subscriptions for approval workflow...');
    await dbUtils.query(migrateExistingSubscriptions);

    console.log('✅ Database migrations completed successfully!');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
};
