import { apiClient } from './api';

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  email: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  success: boolean;
  errorMessage: string | null;
  metadata: Record<string, any>;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  action?: string;
  resourceType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  excludeResourceTypes?: string;
}

export interface AuditLogResponse {
  data: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const auditService = {
  getAuditLogs: (filters: AuditLogFilters = {}): Promise<AuditLogResponse> => {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.action) params.append('action', filters.action);
    if (filters.resourceType) params.append('resourceType', filters.resourceType);
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.search) params.append('search', filters.search);
    if (filters.excludeResourceTypes)
      params.append('excludeResourceTypes', filters.excludeResourceTypes);
    return apiClient.get<AuditLogResponse>(`/admin/audit?${params.toString()}`);
  },

  getAuditActions: (
    excludeResourceTypes?: string,
    resourceType?: string,
  ): Promise<{ actions: string[] }> => {
    const params = new URLSearchParams();
    if (excludeResourceTypes) params.append('excludeResourceTypes', excludeResourceTypes);
    if (resourceType) params.append('resourceType', resourceType);
    const query = params.toString();
    return apiClient.get<{ actions: string[] }>(`/admin/audit/actions${query ? `?${query}` : ''}`);
  },

  getAuditCategories: (): Promise<{ categories: string[] }> => {
    return apiClient.get<{ categories: string[] }>('/admin/audit/categories');
  },
};
