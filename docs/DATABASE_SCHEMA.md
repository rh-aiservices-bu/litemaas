# Database Schema

## Overview
PostgreSQL database schema for LiteMaaS application with focus on user management, subscriptions, and usage tracking.

## Tables

### users
Stores user information from OpenShift OAuth
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    oauth_provider VARCHAR(50) DEFAULT 'openshift',
    oauth_id VARCHAR(255) NOT NULL,
    roles TEXT[] DEFAULT ARRAY['user'],
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(oauth_provider, oauth_id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);
```

### models
Cached model information from LiteLLM
```sql
CREATE TABLE models (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    description TEXT,
    capabilities TEXT[] DEFAULT ARRAY[]::TEXT[],
    context_length INTEGER,
    input_price_per_1k DECIMAL(10, 6),
    output_price_per_1k DECIMAL(10, 6),
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_models_provider ON models(provider);
CREATE INDEX idx_models_active ON models(is_active);
CREATE INDEX idx_models_capabilities ON models USING GIN(capabilities);
```

### subscriptions
User subscriptions to models
```sql
CREATE TYPE subscription_status AS ENUM ('pending', 'active', 'suspended', 'cancelled', 'expired');

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id),
    status subscription_status DEFAULT 'pending',
    quota_requests INTEGER DEFAULT 10000,
    quota_tokens BIGINT DEFAULT 1000000,
    used_requests INTEGER DEFAULT 0,
    used_tokens BIGINT DEFAULT 0,
    reset_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_active_subscription UNIQUE (user_id, model_id, status) WHERE status = 'active'
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_model ON subscriptions(model_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires ON subscriptions(expires_at);
```

### api_keys
API keys for accessing subscribed models
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    name VARCHAR(255),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_api_keys_subscription ON api_keys(subscription_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
```

### usage_logs
Detailed usage logging for analytics
```sql
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    model_id VARCHAR(255) NOT NULL,
    request_tokens INTEGER NOT NULL,
    response_tokens INTEGER NOT NULL,
    total_tokens INTEGER GENERATED ALWAYS AS (request_tokens + response_tokens) STORED,
    latency_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE usage_logs_2024_01 PARTITION OF usage_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE INDEX idx_usage_logs_subscription ON usage_logs(subscription_id);
CREATE INDEX idx_usage_logs_created ON usage_logs(created_at);
CREATE INDEX idx_usage_logs_model ON usage_logs(model_id);
```

### usage_summaries
Pre-aggregated usage statistics for performance
```sql
CREATE TABLE usage_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL,
    period_type VARCHAR(20) NOT NULL, -- 'hour', 'day', 'month'
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subscription_id, model_id, period_type, period_start)
);

CREATE INDEX idx_usage_summaries_subscription ON usage_summaries(subscription_id);
CREATE INDEX idx_usage_summaries_period ON usage_summaries(period_type, period_start);
```

### audit_logs
Security and compliance audit trail
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

## Functions & Triggers

### Update timestamp trigger
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Usage quota enforcement
```sql
CREATE OR REPLACE FUNCTION check_subscription_quota()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.used_requests > OLD.quota_requests OR NEW.used_tokens > OLD.quota_tokens THEN
        NEW.status = 'suspended';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER enforce_subscription_quota BEFORE UPDATE ON subscriptions
    FOR EACH ROW 
    WHEN (NEW.used_requests IS DISTINCT FROM OLD.used_requests OR 
          NEW.used_tokens IS DISTINCT FROM OLD.used_tokens)
    EXECUTE FUNCTION check_subscription_quota();
```

### Automatic usage summary update
```sql
CREATE OR REPLACE FUNCTION update_usage_summary()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO usage_summaries (
        subscription_id,
        model_id,
        period_type,
        period_start,
        request_count,
        total_tokens,
        error_count,
        avg_latency_ms
    )
    VALUES (
        NEW.subscription_id,
        NEW.model_id,
        'hour',
        date_trunc('hour', NEW.created_at),
        1,
        NEW.total_tokens,
        CASE WHEN NEW.status_code >= 400 THEN 1 ELSE 0 END,
        NEW.latency_ms
    )
    ON CONFLICT (subscription_id, model_id, period_type, period_start)
    DO UPDATE SET
        request_count = usage_summaries.request_count + 1,
        total_tokens = usage_summaries.total_tokens + NEW.total_tokens,
        error_count = usage_summaries.error_count + 
            CASE WHEN NEW.status_code >= 400 THEN 1 ELSE 0 END,
        avg_latency_ms = (
            (usage_summaries.avg_latency_ms * usage_summaries.request_count + NEW.latency_ms) / 
            (usage_summaries.request_count + 1)
        );
    
    -- Update subscription usage
    UPDATE subscriptions
    SET used_requests = used_requests + 1,
        used_tokens = used_tokens + NEW.total_tokens
    WHERE id = NEW.subscription_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_usage_on_log AFTER INSERT ON usage_logs
    FOR EACH ROW EXECUTE FUNCTION update_usage_summary();
```

## Views

### Active subscriptions view
```sql
CREATE VIEW active_subscriptions AS
SELECT 
    s.*,
    u.username,
    u.email,
    m.name as model_name,
    m.provider,
    (s.quota_requests - s.used_requests) as remaining_requests,
    (s.quota_tokens - s.used_tokens) as remaining_tokens
FROM subscriptions s
JOIN users u ON s.user_id = u.id
JOIN models m ON s.model_id = m.id
WHERE s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP);
```

### Usage statistics view
```sql
CREATE VIEW usage_statistics AS
SELECT 
    s.user_id,
    s.model_id,
    date_trunc('day', ul.created_at) as usage_date,
    COUNT(*) as request_count,
    SUM(ul.total_tokens) as total_tokens,
    AVG(ul.latency_ms) as avg_latency_ms,
    SUM(CASE WHEN ul.status_code >= 400 THEN 1 ELSE 0 END) as error_count
FROM usage_logs ul
JOIN subscriptions s ON ul.subscription_id = s.id
GROUP BY s.user_id, s.model_id, date_trunc('day', ul.created_at);
```

## Migrations

### Initial setup
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Run all CREATE TABLE statements above
-- Run all CREATE INDEX statements above
-- Run all CREATE FUNCTION statements above
-- Run all CREATE TRIGGER statements above
-- Run all CREATE VIEW statements above
```