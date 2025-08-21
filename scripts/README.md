# LiteMaaS Scripts

This directory contains administrative and utility scripts for managing the LiteMaaS system.

## Scripts

### `reset-user-properties.ts`

A TypeScript script for resetting user properties (max_budget, tpm_limit, rpm_limit) for either all users or a specific user. Updates both the LiteMaaS database and LiteLLM.

#### Prerequisites

- Backend environment must be configured with `.env` file
- Database must be accessible
- LiteLLM API must be accessible
- Required environment variables:
  - `DATABASE_URL`
  - `LITELLM_API_URL`
  - `LITELLM_API_KEY`

#### Usage

```bash
# Method 1: Using npm script (recommended)
cd backend
npm run reset-user-properties

# Method 2: Direct execution with tsx
cd backend
npx tsx ../scripts/reset-user-properties.ts

# Method 3: Using ts-node (if available)
cd scripts
npx ts-node reset-user-properties.ts
```

#### Interactive Flow

The script will prompt you for:

1. **Scope**: Choose between updating all users or a specific user
2. **Username**: If updating a specific user, enter their username
3. **Properties**: Enter new values for any of these properties (press Enter to skip):
   - `max_budget` - Maximum budget in dollars
   - `tpm_limit` - Tokens per minute limit
   - `rpm_limit` - Requests per minute limit
4. **Confirmation**: Review the changes and confirm execution

#### Example Session

```
🔧 LiteMaaS User Properties Reset Tool
==========================================

Choose update scope:
  - Type "all" to update all active users
  - Type a username to update a specific user

Apply changes to (all/username): john.doe

Property Values (press Enter to skip a property):
New max_budget ($): 500.00
New tpm_limit (tokens/min): 5000
New rpm_limit (requests/min): 100

📊 Summary of changes:
==================================================
Scope: User: john.doe
Max Budget: $500
TPM Limit: 5000 tokens/min
RPM Limit: 100 requests/min
==================================================

⚠️  This will update both LiteMaaS database AND LiteLLM!

Proceed with updates? (yes/no): yes

🔄 Processing 1 user(s)...
--------------------------------------------------
✅ [1/1] Updated: john.doe (john.doe@example.com)

📈 Results Summary:
==================================================
✅ Successfully updated: 1 users

🎉 Script completed successfully!
```

#### Features

- **Interactive prompts** with clear instructions
- **Input validation** for numeric values
- **Confirmation step** with summary of changes
- **Colored output** for better readability
- **Progress tracking** when updating multiple users
- **Error handling** with detailed error messages
- **Graceful shutdown** on SIGINT/SIGTERM
- **Database transaction safety**
- **Audit trail** through database updated_at timestamps

#### Error Handling

The script handles various error scenarios:

- **Missing environment variables**: Clear error messages about missing configuration
- **Database connection errors**: Connection timeout and retry logic
- **User not found**: Helpful error message when username doesn't exist
- **Invalid input values**: Validation for negative numbers and non-numeric input
- **LiteLLM API errors**: Continues processing other users if one fails
- **Partial failures**: Reports which users succeeded and which failed

#### Security Considerations

- Script requires direct database access (admin-only)
- All inputs are validated and sanitized
- Database transactions ensure consistency
- Sensitive credentials are loaded from environment variables
- No credentials are logged or displayed

### `build-containers.sh`

Shell script for building Docker containers for the LiteMaaS application.

### `check-backend.js`

Node.js script for checking backend API health and endpoint accessibility.

## Development

When adding new scripts:

1. Place them in this `scripts/` directory
2. Use TypeScript for consistency with the backend
3. Follow the existing patterns for environment loading and error handling
4. Add npm scripts to `backend/package.json` for easy execution
5. Document the script in this README
6. Include proper error handling and user feedback
7. Use the existing backend services and types where possible

## Environment Setup

All scripts expect the backend environment to be properly configured:

```bash
# Ensure backend/.env exists with required variables
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

Required variables for most scripts:
- `DATABASE_URL`: PostgreSQL connection string
- `LITELLM_API_URL`: LiteLLM service URL
- `LITELLM_API_KEY`: LiteLLM API authentication key