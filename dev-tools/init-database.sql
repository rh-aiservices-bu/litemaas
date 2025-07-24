-- LiteMaaS Database Initialization Script
-- PostgreSQL schema for LiteMaaS application

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - User accounts with OAuth integration and LiteLLM sync
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    oauth_provider VARCHAR(50) NOT NULL DEFAULT 'openshift',
    oauth_id VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- LiteLLM Integration Fields
    litellm_user_id VARCHAR(255),
    max_budget DECIMAL(10, 2) DEFAULT 100.00,
    current_spend DECIMAL(10, 2) DEFAULT 0.00,
    tpm_limit INTEGER DEFAULT 1000,
    rpm_limit INTEGER DEFAULT 60,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
    
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(oauth_provider, oauth_id)
);

-- Create index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);
CREATE INDEX idx_users_litellm ON users(litellm_user_id);
CREATE INDEX idx_users_sync_status ON users(sync_status);

-- Models table - AI model registry and metadata with LiteLLM sync
CREATE TABLE IF NOT EXISTS models (
    id VARCHAR(255) PRIMARY KEY, -- Using LiteLLM model ID as primary key
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    provider VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    capabilities JSONB,
    pricing JSONB,
    context_window INTEGER,
    max_tokens INTEGER,
    supports_functions BOOLEAN DEFAULT false,
    supports_vision BOOLEAN DEFAULT false,
    
    -- LiteLLM Enhanced Fields
    object VARCHAR(50) DEFAULT 'model',
    created INTEGER, -- Unix timestamp from LiteLLM
    owned_by VARCHAR(100),
    litellm_provider VARCHAR(100),
    supports_function_calling BOOLEAN DEFAULT false,
    input_price_per_1k DECIMAL(10, 6),
    output_price_per_1k DECIMAL(10, 6),
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for model queries
CREATE INDEX idx_models_provider ON models(provider);
CREATE INDEX idx_models_category ON models(category);
CREATE INDEX idx_models_active ON models(is_active);
CREATE INDEX idx_models_litellm_provider ON models(litellm_provider);

-- Teams table - Team management with LiteLLM integration
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    max_budget DECIMAL(10, 2) DEFAULT 1000.00,
    current_spend DECIMAL(10, 2) DEFAULT 0.00,
    
    -- LiteLLM Integration Fields
    litellm_team_id VARCHAR(255),
    budget_duration VARCHAR(20) DEFAULT 'monthly' CHECK (budget_duration IN ('daily', 'weekly', 'monthly', 'yearly', 'lifetime')),
    tpm_limit INTEGER DEFAULT 10000,
    rpm_limit INTEGER DEFAULT 1000,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for teams
CREATE INDEX idx_teams_created_by ON teams(created_by);
CREATE INDEX idx_teams_litellm ON teams(litellm_team_id);
CREATE INDEX idx_teams_sync_status ON teams(sync_status);

-- Team Members table - Team membership and roles
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

-- Create indexes for team members
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- Subscriptions table - User model subscriptions with enhanced budget tracking
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'cancelled', 'expired')),
    tier VARCHAR(50) NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'pro', 'enterprise')),
    usage_limit INTEGER,
    usage_reset_period VARCHAR(20) DEFAULT 'monthly' CHECK (usage_reset_period IN ('daily', 'weekly', 'monthly', 'yearly')),
    
    -- Enhanced Budget and Rate Limiting
    max_budget DECIMAL(10, 2) DEFAULT 100.00,
    current_spend DECIMAL(10, 2) DEFAULT 0.00,
    budget_duration VARCHAR(20) DEFAULT 'monthly' CHECK (budget_duration IN ('daily', 'weekly', 'monthly', 'yearly', 'lifetime')),
    tpm_limit INTEGER DEFAULT 1000,
    rpm_limit INTEGER DEFAULT 60,
    
    -- LiteLLM Integration Fields
    litellm_key_id VARCHAR(255),
    litellm_key_alias VARCHAR(255),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
    
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, model_id)
);

-- Create indexes for subscription queries
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_model_id ON subscriptions(model_id);
CREATE INDEX idx_subscriptions_team_id ON subscriptions(team_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_litellm ON subscriptions(litellm_key_id);

-- API Keys table - API access keys with LiteLLM integration
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    name VARCHAR(255),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    scopes VARCHAR(255)[] NOT NULL DEFAULT ARRAY['read'],
    
    -- Enhanced Budget and Rate Limiting
    max_budget DECIMAL(10, 2) DEFAULT 100.00,
    current_spend DECIMAL(10, 2) DEFAULT 0.00,
    budget_duration VARCHAR(20) DEFAULT 'monthly' CHECK (budget_duration IN ('daily', 'weekly', 'monthly', 'yearly', 'lifetime')),
    tpm_limit INTEGER DEFAULT 1000,
    rpm_limit INTEGER DEFAULT 60,
    
    -- LiteLLM Integration Fields
    litellm_key_id VARCHAR(255),
    litellm_key_alias VARCHAR(255),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for API key queries
CREATE INDEX idx_api_keys_subscription ON api_keys(subscription_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_litellm ON api_keys(litellm_key_id);
CREATE INDEX idx_api_keys_team ON api_keys(team_id);

-- Usage Logs table - Detailed usage tracking with cost calculation
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    model_id VARCHAR(255) NOT NULL,
    request_id VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    
    -- Token Usage
    request_tokens INTEGER NOT NULL DEFAULT 0,
    response_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (request_tokens + response_tokens) STORED,
    
    -- Cost Calculation Fields
    input_cost DECIMAL(10, 6) DEFAULT 0.000000,
    output_cost DECIMAL(10, 6) DEFAULT 0.000000,
    total_cost DECIMAL(10, 6) GENERATED ALWAYS AS (input_cost + output_cost) STORED,
    
    -- Performance and Error Tracking
    latency_ms INTEGER,
    error_message TEXT,
    
    -- LiteLLM Integration Fields
    litellm_request_id VARCHAR(255),
    
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite primary key including partitioning column
    PRIMARY KEY (id, created_at),
    
    -- Unique constraint including partitioning column
    UNIQUE (request_id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partition for usage logs (example for current month)
CREATE TABLE IF NOT EXISTS usage_logs_2024_01 PARTITION OF usage_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Create indexes for usage queries
CREATE INDEX idx_usage_logs_subscription ON usage_logs(subscription_id);
CREATE INDEX idx_usage_logs_model_id ON usage_logs(model_id);
CREATE INDEX idx_usage_logs_api_key_id ON usage_logs(api_key_id);
CREATE INDEX idx_usage_logs_team ON usage_logs(team_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX idx_usage_logs_request_id ON usage_logs(request_id);
CREATE INDEX idx_usage_logs_litellm ON usage_logs(litellm_request_id);

-- Audit Logs table - Security and admin audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit queries
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries

-- Active subscriptions view with team and budget information
CREATE VIEW active_subscriptions AS
SELECT 
    s.id,
    s.user_id,
    u.username,
    u.email,
    s.model_id,
    m.name as model_name,
    m.display_name as model_display_name,
    m.provider,
    s.team_id,
    t.name as team_name,
    s.tier,
    s.usage_limit,
    s.usage_reset_period,
    s.max_budget,
    s.current_spend,
    (s.max_budget - s.current_spend) as remaining_budget,
    s.tpm_limit,
    s.rpm_limit,
    s.litellm_key_id,
    s.sync_status,
    s.starts_at,
    s.expires_at
FROM subscriptions s
JOIN users u ON s.user_id = u.id
JOIN models m ON s.model_id = m.id
LEFT JOIN teams t ON s.team_id = t.id
WHERE s.status = 'active'
  AND u.is_active = true
  AND m.is_active = true
  AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP);

-- Usage summary view with team and cost information
CREATE VIEW usage_summary AS
SELECT 
    s.user_id,
    u.username,
    u.email,
    ul.team_id,
    t.name as team_name,
    ul.model_id,
    m.name as model_name,
    m.provider,
    DATE_TRUNC('day', ul.created_at) as usage_date,
    COUNT(*) as request_count,
    SUM(ul.total_tokens) as total_tokens,
    SUM(ul.request_tokens) as total_request_tokens,
    SUM(ul.response_tokens) as total_response_tokens,
    SUM(ul.total_cost) as total_cost,
    SUM(ul.input_cost) as total_input_cost,
    SUM(ul.output_cost) as total_output_cost,
    AVG(ul.latency_ms) as avg_latency_ms
FROM usage_logs ul
JOIN subscriptions s ON ul.subscription_id = s.id
JOIN users u ON s.user_id = u.id
JOIN models m ON ul.model_id = m.id
LEFT JOIN teams t ON ul.team_id = t.id
GROUP BY s.user_id, u.username, u.email, ul.team_id, t.name, ul.model_id, m.name, m.provider, DATE_TRUNC('day', ul.created_at);

-- Add comments to tables for documentation
COMMENT ON TABLE users IS 'User accounts with OAuth integration';
COMMENT ON TABLE models IS 'AI model registry and metadata';
COMMENT ON TABLE subscriptions IS 'User model subscriptions';
COMMENT ON TABLE api_keys IS 'API access keys with permissions';
COMMENT ON TABLE usage_logs IS 'Detailed usage tracking';
COMMENT ON TABLE audit_logs IS 'Security and admin audit trail';

-- Sample data for development (commented out by default)
-- Uncomment the following lines to insert sample data

/*
-- Insert sample models
INSERT INTO models (name, display_name, provider, category, description, context_window, max_tokens, supports_functions, supports_vision, pricing) VALUES
('gpt-4', 'GPT-4', 'openai', 'chat', 'Advanced language model with strong reasoning capabilities', 8192, 4096, true, false, '{"input": 0.03, "output": 0.06, "unit": "per_1k_tokens"}'::jsonb),
('gpt-4-vision', 'GPT-4 Vision', 'openai', 'chat', 'GPT-4 with vision capabilities', 128000, 4096, true, true, '{"input": 0.03, "output": 0.06, "unit": "per_1k_tokens"}'::jsonb),
('gpt-3.5-turbo', 'GPT-3.5 Turbo', 'openai', 'chat', 'Fast and efficient language model', 16384, 4096, true, false, '{"input": 0.001, "output": 0.002, "unit": "per_1k_tokens"}'::jsonb),
('claude-3-opus', 'Claude 3 Opus', 'anthropic', 'chat', 'Most powerful Claude model', 200000, 4096, true, false, '{"input": 0.015, "output": 0.075, "unit": "per_1k_tokens"}'::jsonb),
('claude-3-sonnet', 'Claude 3 Sonnet', 'anthropic', 'chat', 'Balanced performance and cost', 200000, 4096, true, false, '{"input": 0.003, "output": 0.015, "unit": "per_1k_tokens"}'::jsonb),
('llama-3-70b', 'Llama 3 70B', 'meta', 'chat', 'Open source large language model', 8192, 2048, false, false, '{"input": 0.0008, "output": 0.0008, "unit": "per_1k_tokens"}'::jsonb);
*/