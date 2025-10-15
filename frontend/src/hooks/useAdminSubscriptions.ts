import { useQuery } from 'react-query';
import { adminSubscriptionsService } from '../services/adminSubscriptions.service';
import type { SubscriptionApprovalFilters, SubscriptionStatus } from '../types/admin';

interface UseAdminSubscriptionsParams {
  statuses?: SubscriptionStatus[];
  modelIds?: string[];
  userIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export const useAdminSubscriptions = (params: UseAdminSubscriptionsParams = {}) => {
  const { statuses, modelIds, userIds, dateFrom, dateTo, page = 1, limit = 20 } = params;

  const filters: SubscriptionApprovalFilters = {
    statuses,
    modelIds,
    userIds,
    dateFrom,
    dateTo,
  };

  return useQuery({
    queryKey: ['adminSubscriptions', filters, page, limit],
    queryFn: () => adminSubscriptionsService.getSubscriptionRequests(filters, page, limit),
    staleTime: 0, // Always consider stale - refetch on every request for fresh mutation data
    refetchOnWindowFocus: false,
    refetchOnMount: 'always', // Always fetch fresh data when component mounts
  });
};
