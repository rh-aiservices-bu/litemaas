import { UserMetadata } from './common.types.js';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  oauthProvider: string;
  oauthId: string;
  roles: string[];
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  username: string;
  email: string;
  fullName?: string;
  oauthProvider: string;
  oauthId: string;
  roles?: string[];
}

export interface UpdateUserDto {
  fullName?: string;
  roles?: string[];
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  roles: string[];
  createdAt: Date;
}

/**
 * Team management types for LiteLLM integration
 */
export interface Team {
  id: string;
  name: string;
  alias?: string;
  description?: string;
  liteLLMTeamId?: string;
  maxBudget?: number;
  currentSpend?: number;
  budgetDuration?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  tpmLimit?: number;
  rpmLimit?: number;
  allowedModels?: string[];
  metadata?: UserMetadata;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  joinedAt: Date;
  addedBy: string;
}

export interface CreateTeamDto {
  name: string;
  alias?: string;
  description?: string;
  maxBudget?: number;
  budgetDuration?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  tpmLimit?: number;
  rpmLimit?: number;
  allowedModels?: string[];
  metadata?: UserMetadata;
  adminIds?: string[]; // Initial admin user IDs
}

export interface UpdateTeamDto {
  name?: string;
  alias?: string;
  description?: string;
  maxBudget?: number;
  budgetDuration?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  tpmLimit?: number;
  rpmLimit?: number;
  allowedModels?: string[];
  metadata?: UserMetadata;
  isActive?: boolean;
}

export interface TeamWithMembers extends Team {
  members: Array<
    TeamMember & {
      user: Pick<User, 'id' | 'username' | 'email' | 'fullName'>;
    }
  >;
  memberCount: number;
}

/**
 * LiteLLM-specific user types
 */
export interface LiteLLMUserRequest {
  user_id?: string;
  user_alias?: string;
  user_email?: string;
  user_role?: 'proxy_admin' | 'internal_user' | 'internal_user_viewer';
  teams?: string[];
  max_budget?: number;
  models?: string[];
  auto_create_key?: boolean;
  tpm_limit?: number;
  rpm_limit?: number;
  budget_duration?: string;
  metadata?: UserMetadata;
}

export interface LiteLLMUserResponse {
  user_id: string;
  user_email?: string;
  user_alias?: string;
  user_role?: string;
  teams?: string[];
  max_budget?: number;
  spend?: number;
  models?: string[];
  tpm_limit?: number;
  rpm_limit?: number;
  api_key?: string; // If auto_create_key was true
  created_at?: string;
  budget_reset_at?: string;
}

// Full response from /user/info endpoint including keys
export interface LiteLLMUserInfoResponse {
  user_id: string;
  user_info: LiteLLMUserResponse & {
    team_id?: string | null;
    sso_user_id?: string | null;
    organization_id?: string | null;
    object_permission_id?: string | null;
    password?: string | null;
    max_parallel_requests?: number | null;
    budget_duration?: string | null;
    allowed_cache_controls?: string[];
    model_spend?: Record<string, number>;
    model_max_budget?: Record<string, number>;
    updated_at?: string;
    litellm_organization_table?: any;
    organization_memberships?: any[];
    invitations_created?: any;
    invitations_updated?: any;
    invitations_user?: any;
    object_permission?: any;
  };
  keys: Array<{
    token: string; // Internal LiteLLM token for API usage tracking
    key_name: string; // Format: "sk-...XXXX" (last 4 chars of actual key)
    key_alias: string;
    soft_budget_cooldown?: boolean;
    spend?: number;
    expires?: string | null;
    models?: string[];
    aliases?: Record<string, any>;
    config?: Record<string, any>;
    user_id?: string;
    team_id?: string | null;
    permissions?: Record<string, any>;
    max_parallel_requests?: number | null;
    metadata?: Record<string, any>;
    blocked?: boolean | null;
    tpm_limit?: number | null;
    rpm_limit?: number | null;
    max_budget?: number | null;
    budget_duration?: string | null;
    budget_reset_at?: string | null;
    allowed_cache_controls?: string[];
    allowed_routes?: string[];
    model_spend?: Record<string, number>;
    model_max_budget?: Record<string, number>;
    budget_id?: string | null;
    organization_id?: string | null;
    object_permission_id?: string | null;
    created_at?: string;
    created_by?: string;
    updated_at?: string;
    updated_by?: string;
    litellm_budget_table?: any;
    litellm_organization_table?: any;
    object_permission?: any;
    team_alias?: string;
  }>;
  teams?: Array<{
    team_alias?: string;
    team_id?: string;
    organization_id?: string | null;
    admins?: string[];
    members?: string[];
    members_with_roles?: Array<{
      user_id?: string;
      user_email?: string | null;
      role?: string;
    }>;
    team_member_permissions?: any[];
    metadata?: Record<string, any>;
    tpm_limit?: number;
    rpm_limit?: number;
    max_budget?: number;
    budget_duration?: string | null;
    models?: string[];
    blocked?: boolean;
    spend?: number;
    max_parallel_requests?: number | null;
    budget_reset_at?: string | null;
    model_id?: string | null;
    litellm_model_table?: any;
    object_permission?: any;
    updated_at?: string;
    created_at?: string;
    object_permission_id?: string | null;
    team_memberships?: any[];
    keys?: any[];
  }>;
}

export interface LiteLLMTeamRequest {
  team_alias: string;
  team_id?: string;
  max_budget?: number;
  models?: string[];
  tpm_limit?: number;
  rpm_limit?: number;
  budget_duration?: string;
  metadata?: UserMetadata;
  admins?: string[];
}

export interface LiteLLMTeamResponse {
  team_id: string;
  team_alias: string;
  max_budget?: number;
  spend?: number;
  models?: string[];
  tpm_limit?: number;
  rpm_limit?: number;
  admins?: string[];
  members?: string[];
  created_at?: string;
  budget_reset_at?: string;
}

/**
 * Enhanced user interface with team and budget support
 */
export interface EnhancedUser extends User {
  // LiteLLM integration fields
  liteLLMUserId?: string;
  liteLLMInfo?: {
    user_role?: 'proxy_admin' | 'internal_user' | 'internal_user_viewer';
    max_budget?: number;
    current_spend?: number;
    tpm_limit?: number;
    rpm_limit?: number;
    budget_duration?: string;
    budget_reset_at?: Date;
    models?: string[];
  };

  // Team associations
  teams?: Array<{
    teamId: string;
    teamName: string;
    role: 'admin' | 'member' | 'viewer';
    joinedAt: Date;
  }>;

  // Budget and usage info
  budgetInfo?: {
    maxBudget?: number;
    currentSpend?: number;
    budgetUtilization?: number;
    remainingBudget?: number;
    nextResetAt?: Date;
  };

  // Sync metadata
  lastSyncAt?: Date;
  syncStatus?: 'synced' | 'pending' | 'error';
  syncError?: string;
}

export interface UserBudgetInfo {
  userId: string;
  maxBudget?: number;
  currentSpend: number;
  budgetUtilization: number; // percentage
  remainingBudget?: number;
  budgetDuration?: string;
  resetAt?: Date;
  lastUpdatedAt: Date;
}

export interface UserTeamAssignment {
  userId: string;
  teamId: string;
  role: 'admin' | 'member' | 'viewer';
  assignedBy: string;
  assignedAt: Date;
}

export interface CreateUserTeamAssignmentDto {
  userId: string;
  teamId: string;
  role: 'admin' | 'member' | 'viewer';
}

export interface TeamListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  createdBy?: string;
}

export interface TeamMemberListParams {
  teamId: string;
  page?: number;
  limit?: number;
  role?: 'admin' | 'member' | 'viewer';
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface CreateAuditLogDto {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}
