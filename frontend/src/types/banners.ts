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
  startDate?: string;
  endDate?: string;
  targetRoles?: string[];
  targetUserIds?: string[];
  linkUrl?: string;
  linkText?: BannerContent;
  markdownEnabled: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBannerRequest {
  name: string;
  content: BannerContent;
  variant?: 'info' | 'warning' | 'danger' | 'success' | 'default';
  isActive?: boolean;
  isDismissible?: boolean;
  dismissDurationHours?: number;
  startDate?: string;
  endDate?: string;
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
  startDate?: string;
  endDate?: string;
  targetRoles?: string[];
  targetUserIds?: string[];
  linkUrl?: string;
  linkText?: BannerContent;
  markdownEnabled?: boolean;
}

export interface SimpleBannerUpdateRequest {
  name?: string;
  isActive: boolean;
  content: BannerContent;
  variant?: 'info' | 'warning' | 'danger' | 'success' | 'default';
  isDismissible?: boolean;
  markdownEnabled?: boolean;
}

export interface BannerApiResponse {
  banner: Banner;
  message: string;
}

export interface BannerDeleteResponse {
  message: string;
}

export interface BannerDismissResponse {
  message: string;
}

export interface BulkVisibilityUpdateRequest {
  [bannerId: string]: boolean;
}
