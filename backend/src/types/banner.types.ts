export interface BannerContent {
  [language: string]: string;
}

export interface Banner {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  content: BannerContent;
  variant: 'info' | 'warning' | 'danger' | 'success' | 'default';
  isDismissible: boolean;
  dismissDurationHours?: number;
  startDate?: Date;
  endDate?: Date;
  targetRoles?: string[];
  targetUserIds?: string[];
  linkUrl?: string;
  linkText?: BannerContent;
  markdownEnabled: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBannerRequest {
  name: string;
  content: BannerContent;
  variant?: 'info' | 'warning' | 'danger' | 'success' | 'default';
  isActive?: boolean;
  isDismissible?: boolean;
  dismissDurationHours?: number;
  startDate?: Date;
  endDate?: Date;
  targetRoles?: string[];
  targetUserIds?: string[];
  linkUrl?: string;
  linkText?: BannerContent;
  markdownEnabled?: boolean;
}

export interface UpdateBannerRequest {
  name?: string;
  isActive?: boolean;
  content?: BannerContent;
  variant?: 'info' | 'warning' | 'danger' | 'success' | 'default';
  isDismissible?: boolean;
  dismissDurationHours?: number;
  startDate?: Date;
  endDate?: Date;
  targetRoles?: string[];
  targetUserIds?: string[];
  linkUrl?: string;
  linkText?: BannerContent;
  markdownEnabled?: boolean;
}

export interface BannerAuditLog {
  id: string;
  bannerId: string;
  action: 'create' | 'update' | 'delete' | 'activate' | 'deactivate';
  changedBy?: string;
  previousState?: Partial<Banner>;
  newState?: Partial<Banner>;
  changedAt: Date;
}

export interface UserBannerDismissal {
  userId: string;
  bannerId: string;
  dismissedAt: Date;
}

// Database row interfaces for mapping
export interface BannerDbRow {
  id: string;
  name: string;
  is_active: boolean;
  priority: number;
  content: Record<string, string>;
  variant: string;
  is_dismissible: boolean;
  dismiss_duration_hours?: number;
  start_date?: Date;
  end_date?: Date;
  target_roles?: string[];
  target_user_ids?: string[];
  link_url?: string;
  link_text?: Record<string, string>;
  markdown_enabled: boolean;
  created_by?: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface BannerAuditLogDbRow {
  id: string;
  banner_id: string;
  action: string;
  changed_by?: string;
  previous_state?: Record<string, any>;
  new_state?: Record<string, any>;
  changed_at: Date;
}

export interface UserBannerDismissalDbRow {
  user_id: string;
  banner_id: string;
  dismissed_at: Date;
}
