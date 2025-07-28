/**
 * Complete LiteMaaS Database Schema
 * All tables required for the application functionality
 */

// Import migration files
import { addApiKeyModelsTable } from '../migrations/001-add-api-key-models';
import { migrateApiKeySubscriptions } from '../migrations/002-migrate-api-key-subscriptions';
import { DatabaseUtils } from '../types/common.types';

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
    lite_llm_user_id VARCHAR(255),
    max_budget DECIMAL(10,2) DEFAULT 100.00,
    tpm_limit INTEGER DEFAULT 1000,
    rpm_limit INTEGER DEFAULT 60,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);
CREATE INDEX IF NOT EXISTS idx_users_lite_llm ON users(lite_llm_user_id);

-- Add missing columns for existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_budget DECIMAL(10,2) DEFAULT 100.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tpm_limit INTEGER DEFAULT 1000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rpm_limit INTEGER DEFAULT 60;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'pending';

-- Add constraint after column exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_sync_status_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_sync_status_check CHECK (sync_status IN ('pending', 'synced', 'error'));
    END IF;
END $$;
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
CREATE INDEX IF NOT EXISTS idx_models_category ON models(category);
CREATE INDEX IF NOT EXISTS idx_models_availability ON models(availability);
`;

// Subscriptions table
export const subscriptionsTable = `
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id),
    team_id UUID REFERENCES teams(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'cancelled', 'expired')),
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
    lite_llm_key_id VARCHAR(255),
    reset_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'error')),
    sync_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_model_id ON subscriptions(model_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_team_id ON subscriptions(team_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_lite_llm ON subscriptions(lite_llm_key_id);
`;

// API Keys table
export const apiKeysTable = `
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    lite_llm_key_id VARCHAR(255),
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
    revoked_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'error')),
    sync_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_subscription_id ON api_keys(subscription_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_lite_llm ON api_keys(lite_llm_key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
`;

// Usage logs table
export const usageLogsTable = `
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id),
    user_id UUID NOT NULL REFERENCES users(id),
    request_tokens INTEGER NOT NULL DEFAULT 0,
    response_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost DECIMAL(10,6) DEFAULT 0,
    latency_ms INTEGER,
    status_code INTEGER NOT NULL,
    error_message TEXT,
    request_id VARCHAR(255),
    endpoint VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_subscription_id ON usage_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_api_key_id ON usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_model_id ON usage_logs(model_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_status_code ON usage_logs(status_code);
`;

// Usage summaries table for aggregated data
export const usageSummariesTable = `
CREATE TABLE IF NOT EXISTS usage_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id),
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('hour', 'day', 'month')),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    total_cost DECIMAL(10,6) DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subscription_id, model_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_summaries_subscription_id ON usage_summaries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_summaries_model_id ON usage_summaries(model_id);
CREATE INDEX IF NOT EXISTS idx_usage_summaries_period ON usage_summaries(period_type, period_start);
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
`;

// Main migration function
export const applyMigrations = async (dbUtils: DatabaseUtils) => {
  console.log('🚀 Starting database migrations...');

  try {
    // Apply all table creations in order (respecting foreign key dependencies)
    console.log('📊 Creating users table...');
    await dbUtils.query(usersTable);

    console.log('👥 Creating teams table...');
    await dbUtils.query(teamsTable);

    console.log('🔗 Creating team_members table...');
    await dbUtils.query(teamMembersTable);

    console.log('🤖 Creating models table...');
    await dbUtils.query(modelsTable);

    console.log('📝 Creating subscriptions table...');
    await dbUtils.query(subscriptionsTable);

    console.log('🔑 Creating api_keys table...');
    await dbUtils.query(apiKeysTable);

    console.log('🔑 Creating api_key_models table...');
    await dbUtils.query(addApiKeyModelsTable);

    console.log('📦 Migrating existing API key subscriptions...');
    await dbUtils.query(migrateApiKeySubscriptions);

    console.log('📈 Creating usage_logs table...');
    await dbUtils.query(usageLogsTable);

    console.log('📊 Creating usage_summaries table...');
    await dbUtils.query(usageSummariesTable);

    console.log('📋 Creating audit_logs table...');
    await dbUtils.query(auditLogsTable);

    console.log('🔄 Creating refresh_tokens table...');
    await dbUtils.query(refreshTokensTable);

    console.log('🔐 Creating oauth_sessions table...');
    await dbUtils.query(oauthSessionsTable);

    console.log('⚡ Creating triggers...');
    await dbUtils.query(updatedAtTriggers);

    console.log('✅ Database migrations completed successfully!');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
};
