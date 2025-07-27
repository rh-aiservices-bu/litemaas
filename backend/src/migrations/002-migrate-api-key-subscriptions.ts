/**
 * Migration: Migrate API Key Subscriptions to Multi-Model Support
 * Purpose: Migrate existing subscription-based API keys to model-based associations
 * Dependencies: api_key_models table, api_keys table, subscriptions table
 */

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