export interface LiteLLMModelCreate {
  model_name: string;
  backend_model_name: string;
  description?: string;
  api_base: string;
  api_key?: string;
  input_cost_per_token: number;
  output_cost_per_token: number;
  tpm: number; // tokens per minute
  rpm: number; // requests per minute
  max_tokens: number;
  supports_vision: boolean;
  supports_function_calling: boolean;
  supports_parallel_function_calling: boolean;
  supports_tool_choice: boolean;
  restrictedAccess?: boolean;
}

export interface LiteLLMModelUpdate extends Partial<LiteLLMModelCreate> {}

export interface AdminModelResponse {
  success: boolean;
  message: string;
  model?: {
    id: string;
    model_name: string;
    created_at?: string;
    updated_at?: string;
  };
}

export interface AdminModelError {
  error: string;
  message: string;
  statusCode: number;
}

export interface LiteLLMModelDisplay {
  id: string;
  model_name: string;
  provider: string;
  api_base?: string;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  tpm?: number;
  rpm?: number;
  max_tokens?: number;
  supports_vision?: boolean;
  supports_function_calling?: boolean;
  supports_parallel_function_calling?: boolean;
  supports_tool_choice?: boolean;
  restrictedAccess?: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminModelFormData {
  model_name: string;
  backend_model_name: string;
  description: string;
  api_base: string;
  api_key: string;
  input_cost_per_token: number;
  output_cost_per_token: number;
  tpm: number;
  rpm: number;
  max_tokens: number;
  supports_vision: boolean;
  supports_function_calling: boolean;
  supports_parallel_function_calling: boolean;
  supports_tool_choice: boolean;
  restrictedAccess: boolean;
}

export interface AdminModelFormErrors {
  model_name?: string;
  backend_model_name?: string;
  description?: string;
  api_base?: string;
  api_key?: string;
  input_cost_per_token?: string;
  output_cost_per_token?: string;
  tpm?: string;
  rpm?: string;
  max_tokens?: string;
}

// Subscription Approval Workflow Types

export type SubscriptionStatus =
  | 'active'
  | 'suspended'
  | 'cancelled'
  | 'expired'
  | 'inactive'
  | 'pending'
  | 'denied';

export interface AdminSubscriptionRequest {
  id: string;
  userId: string;
  modelId: string;
  status: SubscriptionStatus;
  statusReason?: string;
  statusChangedAt?: string;
  statusChangedBy?: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  model: {
    id: string;
    name: string;
    provider: string;
    restrictedAccess: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionApprovalFilters {
  statuses?: SubscriptionStatus[];
  modelIds?: string[];
  userIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ApproveSubscriptionsRequest {
  subscriptionIds: string[];
  reason?: string;
}

export interface DenySubscriptionsRequest {
  subscriptionIds: string[];
  reason: string;
}

export interface RevertSubscriptionRequest {
  newStatus: 'active' | 'denied' | 'pending';
  reason?: string;
}

export interface SubscriptionApprovalStats {
  pendingCount: number;
  approvedToday: number;
  deniedToday: number;
  totalRequests: number;
}
