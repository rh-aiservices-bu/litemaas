# Database Schema

## Overview

PostgreSQL database schema for LiteMaaS application with focus on user management, subscriptions, and usage tracking.

## Tables

### users

Stores user information from OAuth authentication with LiteLLM integration

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    oauth_provider VARCHAR(50) NOT NULL,
    oauth_id VARCHAR(255) NOT NULL,
    roles TEXT[] DEFAULT ARRAY['user'],
    is_active BOOLEAN DEFAULT true,

    -- Budget and Rate Limiting
    max_budget DECIMAL(10, 2) DEFAULT 100.00,
    tpm_limit INTEGER DEFAULT 1000,
    rpm_limit INTEGER DEFAULT 60,
    sync_status VARCHAR(20) DEFAULT 'pending', -- pending, synced, error

    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(oauth_provider, oauth_id)
);

-- Note: lite_llm_user_id column removed - user.id is used directly as LiteLLM user_id

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);
```

### models

Cached model information from LiteLLM with enhanced metadata

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

    -- LiteLLM Enhanced Fields
    max_tokens INTEGER,
    supports_function_calling BOOLEAN DEFAULT false,
    supports_vision BOOLEAN DEFAULT false,
    litellm_provider VARCHAR(100),

    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_models_provider ON models(provider);
CREATE INDEX idx_models_active ON models(is_active);
CREATE INDEX idx_models_capabilities ON models USING GIN(capabilities);
CREATE INDEX idx_models_litellm_provider ON models(litellm_provider);
```

### teams

Team management with LiteLLM integration and Default Team support

```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    alias VARCHAR(255),
    description TEXT,
    created_by UUID REFERENCES users(id), -- Nullable for system-created teams
    max_budget DECIMAL(10, 2) DEFAULT 1000.00,
    current_spend DECIMAL(10, 2) DEFAULT 0.00,

    -- LiteLLM Integration Fields
    litellm_team_id VARCHAR(255),
    budget_duration VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly, lifetime
    tpm_limit INTEGER DEFAULT 10000,
    rpm_limit INTEGER DEFAULT 1000,
    allowed_models JSONB DEFAULT '[]'::JSONB, -- Empty array enables all models
    metadata JSONB DEFAULT '{}'::JSONB,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending', -- pending, synced, error

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Default Team: a0000000-0000-4000-8000-000000000001
-- Created automatically during migration with empty allowed_models array (enables all models)
-- All users are automatically assigned to this team until team management is implemented

CREATE INDEX idx_teams_created_by ON teams(created_by);
CREATE INDEX idx_teams_litellm ON teams(litellm_team_id);
CREATE INDEX idx_teams_sync_status ON teams(sync_status);
```

### team_members

Team membership and roles

```sql
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- admin, member
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
```

### subscriptions

User subscriptions to models with enhanced budget tracking

```sql
CREATE TYPE subscription_status AS ENUM ('pending', 'active', 'suspended', 'cancelled', 'expired');
-- Note: 'cancelled' status is maintained for schema compatibility, but cancellation
-- now permanently deletes subscription records from the database

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    status subscription_status DEFAULT 'pending',
    quota_requests INTEGER DEFAULT 10000,
    quota_tokens BIGINT DEFAULT 1000000,
    used_requests INTEGER DEFAULT 0,
    used_tokens BIGINT DEFAULT 0,

    -- Enhanced Budget and Rate Limiting
    max_budget DECIMAL(10, 2) DEFAULT 100.00,
    current_spend DECIMAL(10, 2) DEFAULT 0.00,
    budget_duration VARCHAR(20) DEFAULT 'monthly',
    tpm_limit INTEGER DEFAULT 1000,
    rpm_limit INTEGER DEFAULT 60,

    -- LiteLLM Integration Fields
    litellm_key_id VARCHAR(255),
    litellm_key_alias VARCHAR(255),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending',

    reset_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_active_subscription UNIQUE (user_id, model_id, status) WHERE status = 'active'
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_model ON subscriptions(model_id);
CREATE INDEX idx_subscriptions_team ON subscriptions(team_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires ON subscriptions(expires_at);
CREATE INDEX idx_subscriptions_litellm ON subscriptions(litellm_key_id);
```

### api_keys

API keys with multi-model support and LiteLLM integration

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL, -- MODIFIED: Now nullable for multi-model support
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,

    -- Enhanced Budget and Rate Limiting
    max_budget DECIMAL(10, 2) DEFAULT 100.00,
    current_spend DECIMAL(10, 2) DEFAULT 0.00,
    budget_duration VARCHAR(20) DEFAULT 'monthly',
    tpm_limit INTEGER DEFAULT 1000,
    rpm_limit INTEGER DEFAULT 60,

    -- LiteLLM Integration Fields
    lite_llm_key_value VARCHAR(255),       -- Stores actual LiteLLM key value (e.g., "sk-litellm-xxxxx")
    litellm_key_alias VARCHAR(255),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending',

    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_api_keys_subscription ON api_keys(subscription_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_litellm ON api_keys(lite_llm_key_value);
CREATE INDEX idx_api_keys_team ON api_keys(team_id);
```

### api_key_models

Junction table for many-to-many relationship between API keys and models

```sql
CREATE TABLE api_key_models (
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (api_key_id, model_id)
);

CREATE INDEX idx_api_key_models_key ON api_key_models(api_key_id);
CREATE INDEX idx_api_key_models_model ON api_key_models(model_id);
```

### usage_logs

Detailed usage logging for analytics with cost calculation

```sql
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    model_id VARCHAR(255) NOT NULL,
    request_tokens INTEGER NOT NULL,
    response_tokens INTEGER NOT NULL,
    total_tokens INTEGER GENERATED ALWAYS AS (request_tokens + response_tokens) STORED,

    -- Cost Calculation Fields
    input_cost DECIMAL(10, 6) DEFAULT 0.000000,
    output_cost DECIMAL(10, 6) DEFAULT 0.000000,
    total_cost DECIMAL(10, 6) GENERATED ALWAYS AS (input_cost + output_cost) STORED,

    latency_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,

    -- LiteLLM Integration Fields
    litellm_request_id VARCHAR(255),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE usage_logs_2024_01 PARTITION OF usage_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE INDEX idx_usage_logs_subscription ON usage_logs(subscription_id);
CREATE INDEX idx_usage_logs_created ON usage_logs(created_at);
CREATE INDEX idx_usage_logs_model ON usage_logs(model_id);
CREATE INDEX idx_usage_logs_team ON usage_logs(team_id);
CREATE INDEX idx_usage_logs_litellm ON usage_logs(litellm_request_id);
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

## Multi-Model API Key Migration

### Migration Overview

The system has been enhanced to support multi-model API keys, allowing a single API key to access multiple models instead of being tied to a single subscription.

### Migration Strategy

1. **Phase 1**: Add new `api_key_models` junction table
2. **Phase 2**: Migrate existing API key data from subscription-based to model-based associations
3. **Phase 3**: Make `subscription_id` nullable in `api_keys` table for backward compatibility

### Migration Scripts

#### Migration 001: Add API Key Models Junction Table

```sql
-- Create junction table for many-to-many relationship
CREATE TABLE api_key_models (
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (api_key_id, model_id)
);

CREATE INDEX idx_api_key_models_key ON api_key_models(api_key_id);
CREATE INDEX idx_api_key_models_model ON api_key_models(model_id);
```

#### Migration 002: Migrate Existing Data

```sql
-- Migrate existing API key-subscription relationships to API key-model relationships
INSERT INTO api_key_models (api_key_id, model_id, created_at)
SELECT
    ak.id as api_key_id,
    s.model_id,
    ak.created_at
FROM api_keys ak
JOIN subscriptions s ON ak.subscription_id = s.id
WHERE ak.subscription_id IS NOT NULL
ON CONFLICT (api_key_id, model_id) DO NOTHING;

-- Make subscription_id nullable for transition period
ALTER TABLE api_keys ALTER COLUMN subscription_id DROP NOT NULL;

-- Add metadata column for additional API key information
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
```

### Enhanced Views

#### Multi-Model API Keys View

```sql
CREATE OR REPLACE VIEW api_keys_with_models AS
SELECT
    ak.id,
    ak.user_id,
    ak.name,
    ak.key_prefix,
    ak.subscription_id, -- Legacy field for backward compatibility
    ak.is_active,
    ak.created_at,
    ak.last_used_at,
    ak.expires_at,
    ak.metadata,
    -- Aggregated model information
    ARRAY_AGG(akm.model_id ORDER BY akm.created_at) as model_ids,
    ARRAY_AGG(m.name ORDER BY akm.created_at) as model_names,
    ARRAY_AGG(m.provider ORDER BY akm.created_at) as model_providers,
    COUNT(akm.model_id) as model_count
FROM api_keys ak
LEFT JOIN api_key_models akm ON ak.id = akm.api_key_id
LEFT JOIN models m ON akm.model_id = m.id
GROUP BY ak.id, ak.user_id, ak.name, ak.key_prefix, ak.subscription_id,
         ak.is_active, ak.created_at, ak.last_used_at, ak.expires_at, ak.metadata;
```

#### Updated Active Subscriptions View

```sql
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT
    s.*,
    u.username,
    u.email,
    m.name as model_name,
    m.provider,
    (s.quota_requests - s.used_requests) as remaining_requests,
    (s.quota_tokens - s.used_tokens) as remaining_tokens,
    -- Count associated API keys (both legacy and new multi-model)
    COALESCE(legacy_keys.count, 0) + COALESCE(multi_model_keys.count, 0) as total_api_keys
FROM subscriptions s
JOIN users u ON s.user_id = u.id
JOIN models m ON s.model_id = m.id
LEFT JOIN (
    -- Legacy API keys directly linked to subscription
    SELECT subscription_id, COUNT(*) as count
    FROM api_keys
    WHERE subscription_id IS NOT NULL AND is_active = true
    GROUP BY subscription_id
) legacy_keys ON s.id = legacy_keys.subscription_id
LEFT JOIN (
    -- New multi-model API keys linked through junction table
    SELECT s2.id as subscription_id, COUNT(DISTINCT ak.id) as count
    FROM subscriptions s2
    JOIN api_key_models akm ON s2.model_id = akm.model_id
    JOIN api_keys ak ON akm.api_key_id = ak.id
    WHERE ak.is_active = true AND s2.user_id = s.user_id
    GROUP BY s2.id
) multi_model_keys ON s.id = multi_model_keys.subscription_id
WHERE s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP);
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

### Default Team Migration

```sql
-- Create Default Team (required for user existence detection)
INSERT INTO teams (
  id, name, alias, description, max_budget, current_spend, budget_duration,
  tpm_limit, rpm_limit, allowed_models, metadata, is_active, created_at, updated_at
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
  '[]'::JSONB, -- Empty array enables all models
  '{"auto_created": true, "default_team": true, "created_by": "system"}'::JSONB,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Assign all existing users to default team
INSERT INTO team_members (team_id, user_id, role, joined_at)
SELECT 'a0000000-0000-4000-8000-000000000001'::UUID, id, 'member', NOW()
FROM users
WHERE id NOT IN (
  SELECT user_id FROM team_members WHERE team_id = 'a0000000-0000-4000-8000-000000000001'::UUID
) ON CONFLICT (team_id, user_id) DO NOTHING;
```

### Database Initialization

```bash
# Database tables are automatically created on backend startup
cd backend && npm run dev

# For development with test data
npm run db:setup  # Seeds the database with test data
```
