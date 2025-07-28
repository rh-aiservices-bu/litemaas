#!/usr/bin/env ts-node

/**
 * Seed script to populate database with essential test data
 * Only seeds users and teams - models come from LiteLLM backend
 * Subscriptions and API keys are created through the application flow
 * Usage: npm run db:seed or tsx src/scripts/seed-data.ts
 */

import { createApp } from '../app';

const sampleUsers = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    username: 'frontend',
    email: 'frontend@litemaas.local',
    full_name: 'Frontend User',
    oauth_provider: 'test',
    oauth_id: 'frontend-test-1',
    roles: ['admin', 'user'],
    is_active: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    username: 'testuser',
    email: 'test@example.com',
    full_name: 'Test User',
    oauth_provider: 'test',
    oauth_id: 'test-user-2',
    roles: ['user'],
    is_active: true,
  },
];

const sampleTeams = [
  {
    id: '550e8400-e29b-41d4-a716-446655440100',
    name: 'Development Team',
    alias: 'dev-team',
    description: 'Main development team for LiteMaaS',
    max_budget: 1000.0,
    budget_duration: 'monthly',
    tpm_limit: 10000,
    rpm_limit: 1000,
    allowed_models: [], // Models will be populated from LiteLLM
    is_active: true,
    created_by: '550e8400-e29b-41d4-a716-446655440001',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440101',
    name: 'Testing Team',
    alias: 'test-team',
    description: 'Quality assurance and testing team',
    max_budget: 500.0,
    budget_duration: 'monthly',
    tpm_limit: 5000,
    rpm_limit: 500,
    allowed_models: [], // Models will be populated from LiteLLM
    is_active: true,
    created_by: '550e8400-e29b-41d4-a716-446655440001',
  },
];

async function seedData() {
  console.log('🌱 Starting database seeding...');

  try {
    const app = await createApp({ logger: false });
    await app.ready();

    // Check if data already exists
    const existingUsers = await app.dbUtils.query('SELECT COUNT(*) as count FROM users');
    if (existingUsers.rows[0].count > 0) {
      console.log('⚠️  Database already contains data. Skipping seed.');
      await app.close();
      return;
    }

    // Insert users
    console.log('👤 Seeding users...');
    for (const user of sampleUsers) {
      await app.dbUtils.query(
        `
        INSERT INTO users (id, username, email, full_name, oauth_provider, oauth_id, roles, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `,
        [
          user.id,
          user.username,
          user.email,
          user.full_name,
          user.oauth_provider,
          user.oauth_id,
          user.roles,
          user.is_active,
        ],
      );
    }

    // Insert teams
    console.log('👥 Seeding teams...');
    for (const team of sampleTeams) {
      await app.dbUtils.query(
        `
        INSERT INTO teams (
          id, name, alias, description, max_budget, budget_duration,
          tpm_limit, rpm_limit, allowed_models, is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `,
        [
          team.id,
          team.name,
          team.alias,
          team.description,
          team.max_budget,
          team.budget_duration,
          team.tpm_limit,
          team.rpm_limit,
          team.allowed_models,
          team.is_active,
          team.created_by,
        ],
      );
    }

    // Add team members
    console.log('🔗 Seeding team memberships...');
    const teamMemberships = [
      {
        team_id: '550e8400-e29b-41d4-a716-446655440100',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        role: 'admin',
      },
      {
        team_id: '550e8400-e29b-41d4-a716-446655440100',
        user_id: '550e8400-e29b-41d4-a716-446655440002',
        role: 'member',
      },
      {
        team_id: '550e8400-e29b-41d4-a716-446655440101',
        user_id: '550e8400-e29b-41d4-a716-446655440002',
        role: 'admin',
      },
    ];

    for (const membership of teamMemberships) {
      await app.dbUtils.query(
        `
        INSERT INTO team_members (team_id, user_id, role, added_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (team_id, user_id) DO NOTHING
      `,
        [
          membership.team_id,
          membership.user_id,
          membership.role,
          '550e8400-e29b-41d4-a716-446655440001', // Frontend user as the one adding members
        ],
      );
    }

    console.log('✅ Database seeding completed successfully!');
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  seedData();
}

export { seedData };
