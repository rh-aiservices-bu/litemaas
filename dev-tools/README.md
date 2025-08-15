# Dev Tools

This directory contains development utilities and scripts for the LiteMaaS project.

## Database Initialization

The database schema is automatically initialized by the backend on first startup. The schema is defined in `backend/src/lib/database-migrations.ts` to avoid duplication.

### Automatic Initialization

When you start the backend for the first time, it will:

1. Connect to PostgreSQL
2. Create all necessary tables
3. Initialize model data from LiteLLM

### Manual Database Setup

If you need to set up the database manually:

```bash
# Create the database
createdb litemaas

# The backend will create tables on startup
cd backend && npm run dev

# For development with test data
cd backend && npm run db:setup
```

### Export Current Schema

To export the current schema for reference:

```bash
node dev-tools/export-schema.js > dev-tools/schema-export.sql
```

This creates a SQL file with the current schema that can be used for:

- Documentation
- Manual database setup
- Database comparisons
- CI/CD pipelines

## Other Dev Tools

(Add other development tools documentation here as needed)
