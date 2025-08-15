#!/usr/bin/env node

/**
 * Export Database Schema from Backend Migrations
 *
 * This script extracts the database schema from the backend's migration system
 * and outputs it as a SQL file for reference or manual database setup.
 *
 * Usage: node dev-tools/export-schema.js > dev-tools/schema-export.sql
 */

const fs = require('fs');
const path = require('path');

// Read the database migrations file
const migrationsPath = path.join(__dirname, '../backend/src/lib/database-migrations.ts');
const migrationsContent = fs.readFileSync(migrationsPath, 'utf8');

// Extract SQL statements from the TypeScript file
const sqlStatements = [];
const sqlPattern = /`([^`]+)`/gs;
let match;

// Skip TypeScript code and extract SQL template literals
const lines = migrationsContent.split('\n');
let inSqlBlock = false;
let currentSql = '';

for (const line of lines) {
  if (line.includes('= `')) {
    inSqlBlock = true;
    currentSql = '';
    continue;
  }

  if (inSqlBlock && line.includes('`;')) {
    inSqlBlock = false;
    if (currentSql.trim()) {
      sqlStatements.push(currentSql.trim());
    }
    continue;
  }

  if (inSqlBlock) {
    currentSql += line + '\n';
  }
}

// Output header
console.log(`-- LiteMaaS Database Schema Export
-- Generated from backend/src/lib/database-migrations.ts
-- Date: ${new Date().toISOString()}
--
-- This is an auto-generated export of the database schema.
-- The authoritative source is in the backend migrations.
--

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`);

// Output all SQL statements
sqlStatements.forEach((sql) => {
  console.log(sql);
  console.log('\n');
});

console.log('-- End of schema export');
