# Database Migration Notes

## Schema Evolution

This document tracks significant database schema changes and their migration strategies.

## Multi-Model API Keys Migration (v2.0.0)

### Overview

Transitioned from single-subscription API keys to multi-model API keys, allowing one key to access multiple models.

### Database Changes

- Added `api_key_models` junction table for many-to-many relationships
- Maintained backward compatibility with existing `subscription_id` column
- Added indexes for performance optimization

### Migration Strategy

1. **Gradual Migration**: Existing keys continue to work with deprecation warnings
2. **Dual Support**: Both legacy and new formats supported simultaneously
3. **Data Migration**: Optional script to convert legacy keys to multi-model format

### Breaking Changes

None - full backward compatibility maintained

## Default Team Implementation (v1.5.0)

### Overview

Added mandatory team assignment for all users to ensure proper LiteLLM integration.

### Database Changes

- Added default team with UUID `a0000000-0000-4000-8000-000000000001`
- Migration automatically creates default team
- All existing users assigned to default team

### Key Features

- Reliable user existence detection via teams array
- Empty `allowed_models` array enables access to all models
- Foundation for future team management features
