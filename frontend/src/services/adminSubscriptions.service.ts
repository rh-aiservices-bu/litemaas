import { apiClient } from './api';
import type {
  AdminSubscriptionRequest,
  SubscriptionApprovalFilters,
  ApproveSubscriptionsRequest,
  DenySubscriptionsRequest,
  RevertSubscriptionRequest,
  SubscriptionApprovalStats,
} from '../types/admin';
import type { PaginatedResponse } from '../types/users';

export const adminSubscriptionsService = {
  /**
   * Get subscription requests with filters
   * @param filters - Filter criteria for subscription requests
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20)
   * @returns Paginated list of subscription requests
   */
  async getSubscriptionRequests(
    filters: SubscriptionApprovalFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<AdminSubscriptionRequest>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    // Add array filters (append multiple values with same key)
    if (filters.statuses?.length) {
      filters.statuses.forEach((status) => params.append('statuses', status));
    }
    if (filters.modelIds?.length) {
      filters.modelIds.forEach((id) => params.append('modelIds', id));
    }
    if (filters.userIds?.length) {
      filters.userIds.forEach((id) => params.append('userIds', id));
    }

    // Add date filters (convert to ISO string)
    if (filters.dateFrom) {
      params.append('dateFrom', filters.dateFrom.toISOString());
    }
    if (filters.dateTo) {
      params.append('dateTo', filters.dateTo.toISOString());
    }

    const response = await apiClient.get<PaginatedResponse<AdminSubscriptionRequest>>(
      `/admin/subscriptions?${params.toString()}`,
    );
    return response;
  },

  /**
   * Get subscription approval statistics
   * @returns Statistics about subscription requests (pending, approved, denied counts)
   */
  async getSubscriptionStats(): Promise<SubscriptionApprovalStats> {
    const response = await apiClient.get<SubscriptionApprovalStats>('/admin/subscriptions/stats');
    return response;
  },

  /**
   * Approve subscriptions (bulk operation)
   * @param request - List of subscription IDs and optional approval comment
   * @returns Result with success/failed count and any errors
   */
  async bulkApprove(request: ApproveSubscriptionsRequest): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ subscription: string; error: string }>;
  }> {
    const response = await apiClient.post<{
      successful: number;
      failed: number;
      errors: Array<{ subscription: string; error: string }>;
    }>('/admin/subscriptions/approve', request);
    return response;
  },

  /**
   * Deny subscriptions (bulk operation)
   * @param request - List of subscription IDs and required denial reason
   * @returns Result with success/failed count and any errors
   */
  async bulkDeny(request: DenySubscriptionsRequest): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ subscription: string; error: string }>;
  }> {
    const response = await apiClient.post<{
      successful: number;
      failed: number;
      errors: Array<{ subscription: string; error: string }>;
    }>('/admin/subscriptions/deny', request);
    return response;
  },

  /**
   * Revert a subscription status decision
   * @param subscriptionId - ID of the subscription to revert
   * @param request - New status and optional reason
   * @returns Updated subscription details
   */
  async revertSubscription(
    subscriptionId: string,
    request: RevertSubscriptionRequest,
  ): Promise<AdminSubscriptionRequest> {
    const response = await apiClient.post<AdminSubscriptionRequest>(
      `/admin/subscriptions/${subscriptionId}/revert`,
      request,
    );
    return response;
  },

  /**
   * Delete a subscription permanently
   * @param subscriptionId - ID of the subscription to delete
   * @param reason - Optional reason for deletion (stored in audit log)
   * @returns Success response
   */
  async deleteSubscription(subscriptionId: string, reason?: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete<{ success: boolean }>(
      `/admin/subscriptions/${subscriptionId}`,
      { data: { reason } },
    );
    return response;
  },
};
