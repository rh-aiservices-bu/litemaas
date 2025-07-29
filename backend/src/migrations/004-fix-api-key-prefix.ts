/**
 * Migration 004: Fix API Key Prefix
 * 
 * This migration fixes the key_prefix column to extract the correct prefix
 * from the actual LiteLLM key (lite_llm_key_value) instead of a locally generated key.
 * 
 * Problem:
 * - key_prefix was being stored from a locally generated key
 * - Should extract prefix from the actual LiteLLM key for display
 * 
 * Solution:
 * - Update existing records to extract prefix from lite_llm_key_value
 * - Only update records that have a lite_llm_key_value
 */

export const fixApiKeyPrefix = `
-- Migration 004: Fix API Key Prefix from LiteLLM Keys
-- Update key_prefix to extract from actual LiteLLM key value

-- Function to extract key prefix (first 7 characters)
-- This mimics the extractKeyPrefix logic from ApiKeyService
UPDATE api_keys 
SET key_prefix = LEFT(lite_llm_key_value, 7),
    updated_at = CURRENT_TIMESTAMP
WHERE lite_llm_key_value IS NOT NULL 
  AND lite_llm_key_value != '' 
  AND LENGTH(lite_llm_key_value) >= 7
  AND key_prefix != LEFT(lite_llm_key_value, 7); -- Only update if different

-- Add a comment to document this fix
COMMENT ON COLUMN api_keys.key_prefix IS 'Display prefix extracted from the actual LiteLLM key (first 7 characters)';

-- Log the migration results for audit purposes
-- Note: This will show the number of updated records
`;

export const rollbackFixApiKeyPrefix = `
-- Rollback Migration 004: Fix API Key Prefix
-- WARNING: This rollback cannot restore original incorrect prefixes
-- It will set key_prefix to a generic placeholder

UPDATE api_keys 
SET key_prefix = 'sk-****',
    updated_at = CURRENT_TIMESTAMP
WHERE lite_llm_key_value IS NOT NULL;

-- Remove the comment
COMMENT ON COLUMN api_keys.key_prefix IS NULL;
`;

export default fixApiKeyPrefix;