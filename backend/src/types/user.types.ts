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