import { apiClient } from './api';

export interface BrandingSettings {
  loginLogoEnabled: boolean;
  hasLoginLogo: boolean;
  loginTitleEnabled: boolean;
  loginTitle: string | null;
  loginSubtitleEnabled: boolean;
  loginSubtitle: string | null;
  headerBrandEnabled: boolean;
  hasHeaderBrandLight: boolean;
  hasHeaderBrandDark: boolean;
  updatedAt: string | null;
}

export interface UpdateBrandingSettingsRequest {
  loginLogoEnabled?: boolean;
  loginTitleEnabled?: boolean;
  loginTitle?: string | null;
  loginSubtitleEnabled?: boolean;
  loginSubtitle?: string | null;
  headerBrandEnabled?: boolean;
}

class BrandingServiceClass {
  async getSettings(): Promise<BrandingSettings> {
    return apiClient.get<BrandingSettings>('/branding');
  }

  async updateSettings(data: UpdateBrandingSettingsRequest): Promise<BrandingSettings> {
    return apiClient.patch<BrandingSettings>('/branding', data);
  }

  async uploadImage(type: string, base64Data: string, mimeType: string): Promise<void> {
    await apiClient.put(`/branding/images/${type}`, { data: base64Data, mimeType });
  }

  async deleteImage(type: string): Promise<void> {
    await apiClient.delete(`/branding/images/${type}`);
  }

  getImageUrl(type: string): string {
    return `/api/v1/branding/images/${type}`;
  }
}

export const brandingService = new BrandingServiceClass();
