/**
 * Unit tests for user schema definitions
 * These tests verify schema exports, structure, field types, and constraints
 */

import { describe, it, expect } from 'vitest';
import { Kind } from '@sinclair/typebox';
import {
  UserSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UserProfileSchema,
  TeamSchema,
  CreateTeamSchema,
  UpdateTeamSchema,
  TeamMemberSchema,
  LiteLLMUserRequestSchema,
  LiteLLMTeamRequestSchema,
  EnhancedUserSchema,
  UserBudgetInfoSchema,
  CreateUserTeamAssignmentSchema,
  TeamListQuerySchema,
  TeamMemberListQuerySchema,
} from '../../../src/schemas/users.js';

describe('Users Schema', () => {
  describe('Schema Exports', () => {
    it('should export UserSchema', () => {
      expect(UserSchema).toBeDefined();
      expect(UserSchema[Kind]).toBe('Object');
    });

    it('should export CreateUserSchema', () => {
      expect(CreateUserSchema).toBeDefined();
      expect(CreateUserSchema[Kind]).toBe('Object');
    });

    it('should export UpdateUserSchema', () => {
      expect(UpdateUserSchema).toBeDefined();
      expect(UpdateUserSchema[Kind]).toBe('Object');
    });

    it('should export UserProfileSchema', () => {
      expect(UserProfileSchema).toBeDefined();
      expect(UserProfileSchema[Kind]).toBe('Object');
    });

    it('should export TeamSchema', () => {
      expect(TeamSchema).toBeDefined();
      expect(TeamSchema[Kind]).toBe('Object');
    });

    it('should export CreateTeamSchema', () => {
      expect(CreateTeamSchema).toBeDefined();
      expect(CreateTeamSchema[Kind]).toBe('Object');
    });

    it('should export UpdateTeamSchema', () => {
      expect(UpdateTeamSchema).toBeDefined();
      expect(UpdateTeamSchema[Kind]).toBe('Object');
    });

    it('should export TeamMemberSchema', () => {
      expect(TeamMemberSchema).toBeDefined();
      expect(TeamMemberSchema[Kind]).toBe('Object');
    });

    it('should export LiteLLMUserRequestSchema', () => {
      expect(LiteLLMUserRequestSchema).toBeDefined();
      expect(LiteLLMUserRequestSchema[Kind]).toBe('Object');
    });

    it('should export LiteLLMTeamRequestSchema', () => {
      expect(LiteLLMTeamRequestSchema).toBeDefined();
      expect(LiteLLMTeamRequestSchema[Kind]).toBe('Object');
    });

    it('should export EnhancedUserSchema', () => {
      expect(EnhancedUserSchema).toBeDefined();
      expect(EnhancedUserSchema[Kind]).toBe('Intersect');
    });

    it('should export UserBudgetInfoSchema', () => {
      expect(UserBudgetInfoSchema).toBeDefined();
      expect(UserBudgetInfoSchema[Kind]).toBe('Object');
    });

    it('should export CreateUserTeamAssignmentSchema', () => {
      expect(CreateUserTeamAssignmentSchema).toBeDefined();
      expect(CreateUserTeamAssignmentSchema[Kind]).toBe('Object');
    });

    it('should export TeamListQuerySchema', () => {
      expect(TeamListQuerySchema).toBeDefined();
      expect(TeamListQuerySchema[Kind]).toBe('Object');
    });

    it('should export TeamMemberListQuerySchema', () => {
      expect(TeamMemberListQuerySchema).toBeDefined();
      expect(TeamMemberListQuerySchema[Kind]).toBe('Object');
    });
  });

  describe('UserSchema Structure', () => {
    it('should have required user fields', () => {
      expect(UserSchema.properties).toHaveProperty('id');
      expect(UserSchema.properties).toHaveProperty('username');
      expect(UserSchema.properties).toHaveProperty('email');
      expect(UserSchema.properties).toHaveProperty('roles');
      expect(UserSchema.properties).toHaveProperty('isActive');
    });

    it('should have email with format validation', () => {
      expect(UserSchema.properties.email.format).toBe('email');
    });

    it('should have roles as array type', () => {
      expect(UserSchema.properties.roles[Kind]).toBe('Array');
    });
  });

  describe('CreateUserSchema Structure', () => {
    it('should have required creation fields', () => {
      expect(CreateUserSchema.properties).toHaveProperty('username');
      expect(CreateUserSchema.properties).toHaveProperty('email');
      expect(CreateUserSchema.properties).toHaveProperty('oauthProvider');
      expect(CreateUserSchema.properties).toHaveProperty('roles');
    });

    it('should have username with minLength constraint', () => {
      expect(CreateUserSchema.properties.username.minLength).toBe(1);
    });

    it('should have email with format validation', () => {
      expect(CreateUserSchema.properties.email.format).toBe('email');
    });
  });

  describe('UpdateUserSchema Structure', () => {
    it('should have update fields defined', () => {
      expect(UpdateUserSchema.properties).toHaveProperty('username');
      expect(UpdateUserSchema.properties).toHaveProperty('email');
      expect(UpdateUserSchema.properties).toHaveProperty('roles');
      expect(UpdateUserSchema.properties).toHaveProperty('isActive');
    });
  });

  describe('TeamSchema Structure', () => {
    it('should have required team fields', () => {
      expect(TeamSchema.properties).toHaveProperty('id');
      expect(TeamSchema.properties).toHaveProperty('name');
      expect(TeamSchema.properties).toHaveProperty('isActive');
      expect(TeamSchema.properties).toHaveProperty('createdAt');
    });

    it('should have budgetDuration with union type', () => {
      expect(TeamSchema.properties.budgetDuration).toBeDefined();
    });
  });

  describe('CreateTeamSchema Structure', () => {
    it('should have name with minLength constraint', () => {
      expect(CreateTeamSchema.properties.name.minLength).toBe(1);
    });

    it('should have budget and limit fields', () => {
      expect(CreateTeamSchema.properties).toHaveProperty('maxBudget');
      expect(CreateTeamSchema.properties).toHaveProperty('tpmLimit');
      expect(CreateTeamSchema.properties).toHaveProperty('rpmLimit');
    });
  });

  describe('TeamMemberSchema Structure', () => {
    it('should have required member fields', () => {
      expect(TeamMemberSchema.properties).toHaveProperty('id');
      expect(TeamMemberSchema.properties).toHaveProperty('teamId');
      expect(TeamMemberSchema.properties).toHaveProperty('userId');
      expect(TeamMemberSchema.properties).toHaveProperty('role');
    });

    it('should have role as union type', () => {
      expect(TeamMemberSchema.properties.role[Kind]).toBe('Union');
    });
  });

  describe('LiteLLMUserRequestSchema Structure', () => {
    it('should have LiteLLM user fields', () => {
      expect(LiteLLMUserRequestSchema.properties).toHaveProperty('user_id');
      expect(LiteLLMUserRequestSchema.properties).toHaveProperty('user_email');
      expect(LiteLLMUserRequestSchema.properties).toHaveProperty('max_budget');
    });
  });

  describe('LiteLLMTeamRequestSchema Structure', () => {
    it('should have team_alias with minLength', () => {
      expect(LiteLLMTeamRequestSchema.properties.team_alias.minLength).toBe(1);
    });

    it('should have budget and limit fields', () => {
      expect(LiteLLMTeamRequestSchema.properties).toHaveProperty('max_budget');
      expect(LiteLLMTeamRequestSchema.properties).toHaveProperty('tpm_limit');
      expect(LiteLLMTeamRequestSchema.properties).toHaveProperty('rpm_limit');
    });
  });

  describe('CreateUserTeamAssignmentSchema Structure', () => {
    it('should have assignment fields', () => {
      expect(CreateUserTeamAssignmentSchema.properties).toHaveProperty('userId');
      expect(CreateUserTeamAssignmentSchema.properties).toHaveProperty('teamId');
      expect(CreateUserTeamAssignmentSchema.properties).toHaveProperty('role');
    });

    it('should have role as union type', () => {
      expect(CreateUserTeamAssignmentSchema.properties.role[Kind]).toBe('Union');
    });
  });

  describe('TeamListQuerySchema Structure', () => {
    it('should have pagination fields', () => {
      expect(TeamListQuerySchema.properties).toHaveProperty('page');
      expect(TeamListQuerySchema.properties).toHaveProperty('limit');
      expect(TeamListQuerySchema.properties).toHaveProperty('search');
    });
  });

  describe('TeamMemberListQuerySchema Structure', () => {
    it('should have teamId field', () => {
      expect(TeamMemberListQuerySchema.properties).toHaveProperty('teamId');
    });

    it('should have pagination fields', () => {
      expect(TeamMemberListQuerySchema.properties).toHaveProperty('page');
      expect(TeamMemberListQuerySchema.properties).toHaveProperty('limit');
    });
  });

  describe('Complex Schema Types', () => {
    it('should have EnhancedUserSchema as intersection', () => {
      expect(EnhancedUserSchema[Kind]).toBe('Intersect');
      expect(EnhancedUserSchema.allOf).toBeDefined();
      expect(Array.isArray(EnhancedUserSchema.allOf)).toBe(true);
    });

    it('should have UserBudgetInfoSchema with budget fields', () => {
      expect(UserBudgetInfoSchema.properties).toHaveProperty('userId');
      expect(UserBudgetInfoSchema.properties).toHaveProperty('currentSpend');
      expect(UserBudgetInfoSchema.properties).toHaveProperty('budgetUtilization');
    });
  });
});
