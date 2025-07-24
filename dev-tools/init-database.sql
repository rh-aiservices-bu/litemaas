-- LiteMaaS Database Initialization Script
-- PostgreSQL schema for LiteMaaS application

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - User accounts with OAuth integration
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
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(oauth_provider, oauth_id)
);

-- Create index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);

-- Models table - AI model registry and metadata
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    capabilities JSONB,
    pricing JSONB,
    context_window INTEGER,
    max_tokens INTEGER,
    supports_functions BOOLEAN DEFAULT false,
    supports_vision BOOLEAN DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for model queries
CREATE INDEX idx_models_provider ON models(provider);
CREATE INDEX idx_models_category ON models(category);
CREATE INDEX idx_models_active ON models(is_active);

-- Subscriptions table - User model subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
    tier VARCHAR(50) NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'pro', 'enterprise')),
    usage_limit INTEGER,
    usage_reset_period VARCHAR(20) DEFAULT 'monthly' CHECK (usage_reset_period IN ('daily', 'weekly', 'monthly', 'yearly')),
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
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- API Keys table - API access keys with permissions
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    scopes VARCHAR(255)[] NOT NULL DEFAULT ARRAY['read'],
    rate_limit INTEGER DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for API key queries
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Usage Logs table - Detailed usage tracking
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    request_id VARCHAR(255) UNIQUE NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for usage queries
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_model_id ON usage_logs(model_id);
CREATE INDEX idx_usage_logs_subscription_id ON usage_logs(subscription_id);
CREATE INDEX idx_usage_logs_api_key_id ON usage_logs(api_key_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX idx_usage_logs_request_id ON usage_logs(request_id);

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

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries

-- Active subscriptions view
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
    s.tier,
    s.usage_limit,
    s.usage_reset_period,
    s.starts_at,
    s.expires_at
FROM subscriptions s
JOIN users u ON s.user_id = u.id
JOIN models m ON s.model_id = m.id
WHERE s.status = 'active'
  AND u.is_active = true
  AND m.is_active = true
  AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP);

-- Usage summary view
CREATE VIEW usage_summary AS
SELECT 
    u.id as user_id,
    u.username,
    u.email,
    m.id as model_id,
    m.name as model_name,
    m.provider,
    DATE_TRUNC('day', ul.created_at) as usage_date,
    COUNT(*) as request_count,
    SUM(ul.tokens_used) as total_tokens,
    SUM(ul.prompt_tokens) as total_prompt_tokens,
    SUM(ul.completion_tokens) as total_completion_tokens,
    SUM(ul.total_cost) as total_cost,
    AVG(ul.response_time_ms) as avg_response_time_ms
FROM usage_logs ul
JOIN users u ON ul.user_id = u.id
JOIN models m ON ul.model_id = m.id
GROUP BY u.id, u.username, u.email, m.id, m.name, m.provider, DATE_TRUNC('day', ul.created_at);

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