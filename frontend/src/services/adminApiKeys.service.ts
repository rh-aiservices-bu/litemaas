/**
 * Admin API Management service — system-wide API key listing and bulk revoke.
 * Backend: /api/v1/admin/api-keys/* (admin-api-keys.ts)
 */
import { apiClient } from './api';

export type AdminKeyStatus = 'active' | 'revoked' | 'expired' | 'archived';

export interface AdminApiKeyRow {
  id: string;
  name: string;
  keyPrefix?: string;
  status: AdminKeyStatus;
  isActive: boolean;
  userId: string;
  username?: string;
  email?: string;
  models: string[];
  maxBudget?: number;
  currentSpend?: number;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  revokedAt?: string;
  archivedAt?: string;
}

export interface AdminApiKeysStats {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  archived: number;
}

export interface AdminApiKeysListParams {
  page?: number;
  limit?: number;
  status?: AdminKeyStatus | 'all';
  userId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'name' | 'lastUsedAt' | 'username' | 'currentSpend';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminApiKeysListResponse {
  data: AdminApiKeyRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: AdminApiKeysStats;
}

export interface BulkRevokeResult {
  revoked: number;
  failed: number;
  results: Array<{ keyId: string; success: boolean; error?: string }>;
}

class AdminApiKeysService {
  async listAllKeys(params: AdminApiKeysListParams = {}): Promise<AdminApiKeysListResponse> {
    const search = new URLSearchParams();
    if (params.page) search.set('page', String(params.page));
    if (params.limit) search.set('limit', String(params.limit));
    if (params.status) search.set('status', params.status);
    if (params.userId) search.set('userId', params.userId);
    if (params.search) search.set('search', params.search);
    if (params.sortBy) search.set('sortBy', params.sortBy);
    if (params.sortOrder) search.set('sortOrder', params.sortOrder);

    return apiClient.get<AdminApiKeysListResponse>(
      `/admin/api-keys/all${search.toString() ? `?${search.toString()}` : ''}`,
    );
  }

  async bulkRevoke(keyIds: string[], reason?: string): Promise<BulkRevokeResult> {
    return apiClient.post<BulkRevokeResult>('/admin/api-keys/bulk-revoke', {
      keyIds,
      reason,
    });
  }

  async cleanupExpired(): Promise<{ message: string; cleanedCount: number }> {
    return apiClient.post<{ message: string; cleanedCount: number }>('/admin/api-keys/cleanup-expired');
  }
}

export const adminApiKeysService = new AdminApiKeysService();
