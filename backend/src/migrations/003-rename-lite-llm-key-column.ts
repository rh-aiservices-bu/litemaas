/**
 * Migration 003: Rename lite_llm_key_id to lite_llm_key_value
 * 
 * This migration renames the misleading 'lite_llm_key_id' column to 'lite_llm_key_value'
 * in both the subscriptions and api_keys tables to accurately reflect that it stores
 * the actual LiteLLM key value, not an ID.
 */

export const renameLiteLLMKeyColumn = `
-- Rename column in subscriptions table
ALTER TABLE subscriptions 
  RENAME COLUMN lite_llm_key_id TO lite_llm_key_value;

-- Rename column in api_keys table  
ALTER TABLE api_keys 
  RENAME COLUMN lite_llm_key_id TO lite_llm_key_value;

-- Drop old indexes
DROP INDEX IF EXISTS idx_subscriptions_lite_llm;
DROP INDEX IF EXISTS idx_api_keys_lite_llm;

-- Create new indexes with updated column name
CREATE INDEX IF NOT EXISTS idx_subscriptions_lite_llm_key_value ON subscriptions(lite_llm_key_value);
CREATE INDEX IF NOT EXISTS idx_api_keys_lite_llm_key_value ON api_keys(lite_llm_key_value);

-- Add comments for documentation
COMMENT ON COLUMN subscriptions.lite_llm_key_value IS 'The actual LiteLLM key value for this subscription';
COMMENT ON COLUMN api_keys.lite_llm_key_value IS 'The actual LiteLLM key value for this API key';
`;

export default renameLiteLLMKeyColumn;