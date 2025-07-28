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
  isActive?: boolean;
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
