export interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  roles: string[];
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}

export interface UserUpdateData {
  roles?: string[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface UserActivity {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface UserStats {
  subscriptions: {
    total: number;
    active: number;
    suspended: number;
  };
  apiKeys: {
    total: number;
    active: number;
  };
  usage: {
    totalRequests: number;
    totalTokens: number;
    currentMonthRequests: number;
    currentMonthTokens: number;
  };
  lastLogin?: string;
  memberSince: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  roles: string[];
  createdAt: string;
}
