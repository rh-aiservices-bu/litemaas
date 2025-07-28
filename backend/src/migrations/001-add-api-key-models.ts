/**
 * Migration: Add API Key Models Junction Table
 * Purpose: Create many-to-many relationship between API keys and models
 * Dependencies: api_keys table, models table
 */

export const addApiKeyModelsTable = `
-- Create junction table for many-to-many relationship between API keys and models
CREATE TABLE IF NOT EXISTS api_key_models (
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (api_key_id, model_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_key_models_api_key ON api_key_models(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_models_model ON api_key_models(model_id);

-- Add comment for documentation
COMMENT ON TABLE api_key_models IS 'Junction table linking API keys to multiple models';
`;
