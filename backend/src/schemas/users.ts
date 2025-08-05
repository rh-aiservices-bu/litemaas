import { Type } from '@sinclair/typebox';
import { TimestampSchema } from './common.js';

/**
 * User schema definitions
 */
export const UserSchema = Type.Object({
  id: Type.String(),
  username: Type.String(),
  email: Type.String({ format: 'email' }),
  fullName: Type.Optional(Type.String()),
  oauthProvider: Type.String(),
  oauthId: Type.String(),
  roles: Type.Array(Type.String()),
  isActive: Type.Boolean(),
  lastLoginAt: Type.Optional(TimestampSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateUserSchema = Type.Object({
  username: Type.String({ minLength: 1 }),
  email: Type.String({ format: 'email' }),
  fullName: Type.Optional(Type.String()),
  oauthProvider: Type.String(),
  oauthId: Type.String(),
  roles: Type.Array(Type.String()),
});

export const UpdateUserSchema = Type.Object({
  username: Type.Optional(Type.String({ minLength: 1 })),
  email: Type.Optional(Type.String({ format: 'email' })),
  fullName: Type.Optional(Type.String()),
  roles: Type.Optional(Type.Array(Type.String())),
  isActive: Type.Optional(Type.Boolean()),
});

export const UserProfileSchema = Type.Object({
  id: Type.String(),
  username: Type.String(),
  email: Type.String(),
  fullName: Type.Optional(Type.String()),
  roles: Type.Array(Type.String()),
  createdAt: TimestampSchema,
});

/**
 * Team management schemas
 */
export const TeamSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  alias: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  liteLLMTeamId: Type.Optional(Type.String()),
  maxBudget: Type.Optional(Type.Number()),
  currentSpend: Type.Optional(Type.Number()),
  budgetDuration: Type.Optional(
    Type.Union([
      Type.Literal('daily'),
      Type.Literal('weekly'),
      Type.Literal('monthly'),
      Type.Literal('yearly'),
    ]),
  ),
  tpmLimit: Type.Optional(Type.Number()),
  rpmLimit: Type.Optional(Type.Number()),
  allowedModels: Type.Optional(Type.Array(Type.String())),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
  isActive: Type.Boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: Type.String(),
});

export const CreateTeamSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  alias: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  maxBudget: Type.Optional(Type.Number({ minimum: 0 })),
  budgetDuration: Type.Optional(
    Type.Union([
      Type.Literal('daily'),
      Type.Literal('weekly'),
      Type.Literal('monthly'),
      Type.Literal('yearly'),
    ]),
  ),
  tpmLimit: Type.Optional(Type.Number({ minimum: 0 })),
  rpmLimit: Type.Optional(Type.Number({ minimum: 0 })),
  allowedModels: Type.Optional(Type.Array(Type.String())),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
  adminIds: Type.Optional(Type.Array(Type.String())),
});

export const UpdateTeamSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  alias: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  maxBudget: Type.Optional(Type.Number({ minimum: 0 })),
  budgetDuration: Type.Optional(
    Type.Union([
      Type.Literal('daily'),
      Type.Literal('weekly'),
      Type.Literal('monthly'),
      Type.Literal('yearly'),
    ]),
  ),
  tpmLimit: Type.Optional(Type.Number({ minimum: 0 })),
  rpmLimit: Type.Optional(Type.Number({ minimum: 0 })),
  allowedModels: Type.Optional(Type.Array(Type.String())),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
  isActive: Type.Optional(Type.Boolean()),
});

export const TeamMemberSchema = Type.Object({
  id: Type.String(),
  teamId: Type.String(),
  userId: Type.String(),
  role: Type.Union([Type.Literal('admin'), Type.Literal('member'), Type.Literal('viewer')]),
  joinedAt: TimestampSchema,
  addedBy: Type.String(),
});

export const TeamWithMembersSchema = Type.Intersect([
  TeamSchema,
  Type.Object({
    members: Type.Array(
      Type.Intersect([
        TeamMemberSchema,
        Type.Object({
          user: Type.Pick(UserSchema, ['id', 'username', 'email', 'fullName']),
        }),
      ]),
    ),
    memberCount: Type.Number(),
  }),
]);

/**
 * LiteLLM integration schemas
 */
export const LiteLLMUserRequestSchema = Type.Object({
  user_id: Type.Optional(Type.String()),
  user_alias: Type.Optional(Type.String()),
  user_email: Type.Optional(Type.String({ format: 'email' })),
  user_role: Type.Optional(
    Type.Union([
      Type.Literal('proxy_admin'),
      Type.Literal('internal_user'),
      Type.Literal('internal_user_viewer'),
    ]),
  ),
  teams: Type.Optional(Type.Array(Type.String())),
  max_budget: Type.Optional(Type.Number({ minimum: 0 })),
  models: Type.Optional(Type.Array(Type.String())),
  auto_create_key: Type.Optional(Type.Boolean()),
  tpm_limit: Type.Optional(Type.Number({ minimum: 0 })),
  rpm_limit: Type.Optional(Type.Number({ minimum: 0 })),
  budget_duration: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

export const LiteLLMUserResponseSchema = Type.Object({
  user_id: Type.String(),
  user_email: Type.Optional(Type.String()),
  user_alias: Type.Optional(Type.String()),
  user_role: Type.Optional(Type.String()),
  teams: Type.Optional(Type.Array(Type.String())),
  max_budget: Type.Optional(Type.Number()),
  spend: Type.Optional(Type.Number()),
  models: Type.Optional(Type.Array(Type.String())),
  tpm_limit: Type.Optional(Type.Number()),
  rpm_limit: Type.Optional(Type.Number()),
  api_key: Type.Optional(Type.String()),
  created_at: Type.Optional(Type.String()),
  budget_reset_at: Type.Optional(Type.String()),
});

export const LiteLLMTeamRequestSchema = Type.Object({
  team_alias: Type.String({ minLength: 1 }),
  team_id: Type.Optional(Type.String()),
  max_budget: Type.Optional(Type.Number({ minimum: 0 })),
  models: Type.Optional(Type.Array(Type.String())),
  tpm_limit: Type.Optional(Type.Number({ minimum: 0 })),
  rpm_limit: Type.Optional(Type.Number({ minimum: 0 })),
  budget_duration: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
  admins: Type.Optional(Type.Array(Type.String())),
});

export const LiteLLMTeamResponseSchema = Type.Object({
  team_id: Type.String(),
  team_alias: Type.String(),
  max_budget: Type.Optional(Type.Number()),
  spend: Type.Optional(Type.Number()),
  models: Type.Optional(Type.Array(Type.String())),
  tpm_limit: Type.Optional(Type.Number()),
  rpm_limit: Type.Optional(Type.Number()),
  admins: Type.Optional(Type.Array(Type.String())),
  members: Type.Optional(Type.Array(Type.String())),
  created_at: Type.Optional(Type.String()),
  budget_reset_at: Type.Optional(Type.String()),
});

/**
 * Enhanced user schema with LiteLLM integration
 */
export const EnhancedUserSchema = Type.Intersect([
  UserSchema,
  Type.Object({
    liteLLMUserId: Type.Optional(Type.String()),
    liteLLMInfo: Type.Optional(
      Type.Object({
        user_role: Type.Optional(
          Type.Union([
            Type.Literal('proxy_admin'),
            Type.Literal('internal_user'),
            Type.Literal('internal_user_viewer'),
          ]),
        ),
        max_budget: Type.Optional(Type.Number()),
        current_spend: Type.Optional(Type.Number()),
        tpm_limit: Type.Optional(Type.Number()),
        rpm_limit: Type.Optional(Type.Number()),
        budget_duration: Type.Optional(Type.String()),
        budget_reset_at: Type.Optional(TimestampSchema),
        models: Type.Optional(Type.Array(Type.String())),
      }),
    ),
    teams: Type.Optional(
      Type.Array(
        Type.Object({
          teamId: Type.String(),
          teamName: Type.String(),
          role: Type.Union([Type.Literal('admin'), Type.Literal('member'), Type.Literal('viewer')]),
          joinedAt: TimestampSchema,
        }),
      ),
    ),
    budgetInfo: Type.Optional(
      Type.Object({
        maxBudget: Type.Optional(Type.Number()),
        currentSpend: Type.Optional(Type.Number()),
        budgetUtilization: Type.Optional(Type.Number()),
        remainingBudget: Type.Optional(Type.Number()),
        nextResetAt: Type.Optional(TimestampSchema),
      }),
    ),
    lastSyncAt: Type.Optional(TimestampSchema),
    syncStatus: Type.Optional(
      Type.Union([Type.Literal('synced'), Type.Literal('pending'), Type.Literal('error')]),
    ),
    syncError: Type.Optional(Type.String()),
  }),
]);

/**
 * Budget and team assignment schemas
 */
export const UserBudgetInfoSchema = Type.Object({
  userId: Type.String(),
  maxBudget: Type.Optional(Type.Number()),
  currentSpend: Type.Number(),
  budgetUtilization: Type.Number(),
  remainingBudget: Type.Optional(Type.Number()),
  budgetDuration: Type.Optional(Type.String()),
  resetAt: Type.Optional(TimestampSchema),
  lastUpdatedAt: TimestampSchema,
});

export const CreateUserTeamAssignmentSchema = Type.Object({
  userId: Type.String(),
  teamId: Type.String(),
  role: Type.Union([Type.Literal('admin'), Type.Literal('member'), Type.Literal('viewer')]),
});

export const TeamListQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  search: Type.Optional(Type.String()),
  isActive: Type.Optional(Type.Boolean()),
  createdBy: Type.Optional(Type.String()),
});

export const TeamMemberListQuerySchema = Type.Object({
  teamId: Type.String(),
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  role: Type.Optional(
    Type.Union([Type.Literal('admin'), Type.Literal('member'), Type.Literal('viewer')]),
  ),
});
