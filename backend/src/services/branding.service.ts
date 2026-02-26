import { FastifyInstance } from 'fastify';
import { BaseService } from './base.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/svg+xml',
  'image/gif',
  'image/webp',
];

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

type ImageType = 'login-logo' | 'header-brand-light' | 'header-brand-dark';

interface BrandingSettingsRow {
  login_logo_enabled: boolean;
  login_logo_data: string | null;
  login_logo_mime_type: string | null;
  login_title_enabled: boolean;
  login_title: string | null;
  login_subtitle_enabled: boolean;
  login_subtitle: string | null;
  header_brand_enabled: boolean;
  header_brand_light_data: string | null;
  header_brand_light_mime_type: string | null;
  header_brand_dark_data: string | null;
  header_brand_dark_mime_type: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

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

export interface BrandingImage {
  data: Buffer;
  mimeType: string;
}

const IMAGE_TYPE_COLUMNS: Record<ImageType, { data: string; mime: string }> = {
  'login-logo': { data: 'login_logo_data', mime: 'login_logo_mime_type' },
  'header-brand-light': { data: 'header_brand_light_data', mime: 'header_brand_light_mime_type' },
  'header-brand-dark': { data: 'header_brand_dark_data', mime: 'header_brand_dark_mime_type' },
};

export class BrandingService extends BaseService {
  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  async getSettings(): Promise<BrandingSettings> {
    const row = await this.executeQueryOne<BrandingSettingsRow>(
      'SELECT * FROM branding_settings WHERE id = 1',
      [],
      'getting branding settings',
    );

    if (!row) {
      return {
        loginLogoEnabled: false,
        hasLoginLogo: false,
        loginTitleEnabled: false,
        loginTitle: null,
        loginSubtitleEnabled: false,
        loginSubtitle: null,
        headerBrandEnabled: false,
        hasHeaderBrandLight: false,
        hasHeaderBrandDark: false,
        updatedAt: null,
      };
    }

    return {
      loginLogoEnabled: row.login_logo_enabled,
      hasLoginLogo: !!row.login_logo_data,
      loginTitleEnabled: row.login_title_enabled,
      loginTitle: row.login_title,
      loginSubtitleEnabled: row.login_subtitle_enabled,
      loginSubtitle: row.login_subtitle,
      headerBrandEnabled: row.header_brand_enabled,
      hasHeaderBrandLight: !!row.header_brand_light_data,
      hasHeaderBrandDark: !!row.header_brand_dark_data,
      updatedAt: row.updated_at,
    };
  }

  async updateSettings(
    data: {
      loginLogoEnabled?: boolean;
      loginTitleEnabled?: boolean;
      loginTitle?: string | null;
      loginSubtitleEnabled?: boolean;
      loginSubtitle?: string | null;
      headerBrandEnabled?: boolean;
    },
    userId: string,
  ): Promise<BrandingSettings> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.loginLogoEnabled !== undefined) {
      setClauses.push(`login_logo_enabled = $${paramIndex++}`);
      params.push(data.loginLogoEnabled);
    }
    if (data.loginTitleEnabled !== undefined) {
      setClauses.push(`login_title_enabled = $${paramIndex++}`);
      params.push(data.loginTitleEnabled);
    }
    if (data.loginTitle !== undefined) {
      setClauses.push(`login_title = $${paramIndex++}`);
      params.push(data.loginTitle);
    }
    if (data.loginSubtitleEnabled !== undefined) {
      setClauses.push(`login_subtitle_enabled = $${paramIndex++}`);
      params.push(data.loginSubtitleEnabled);
    }
    if (data.loginSubtitle !== undefined) {
      setClauses.push(`login_subtitle = $${paramIndex++}`);
      params.push(data.loginSubtitle);
    }
    if (data.headerBrandEnabled !== undefined) {
      setClauses.push(`header_brand_enabled = $${paramIndex++}`);
      params.push(data.headerBrandEnabled);
    }

    if (setClauses.length === 0) {
      return this.getSettings();
    }

    setClauses.push(`updated_at = NOW()`);
    setClauses.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    await this.executeQuery(
      `UPDATE branding_settings SET ${setClauses.join(', ')} WHERE id = 1`,
      params,
      'updating branding settings',
    );

    return this.getSettings();
  }

  async uploadImage(type: ImageType, base64Data: string, mimeType: string, userId: string): Promise<void> {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw this.createValidationError(
        `Invalid image format: ${mimeType}`,
        'mimeType',
        mimeType,
        `Allowed formats: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Validate base64 decoded size
    const decodedSize = Buffer.from(base64Data, 'base64').length;
    if (decodedSize > MAX_IMAGE_SIZE_BYTES) {
      throw this.createValidationError(
        `Image size ${(decodedSize / 1024 / 1024).toFixed(2)} MB exceeds maximum of 2 MB`,
        'data',
        undefined,
        'Please upload a smaller image (max 2 MB)',
      );
    }

    const columns = IMAGE_TYPE_COLUMNS[type];
    if (!columns) {
      throw this.createValidationError('Invalid image type', 'type', type);
    }

    await this.executeQuery(
      `UPDATE branding_settings SET ${columns.data} = $1, ${columns.mime} = $2, updated_at = NOW(), updated_by = $3 WHERE id = 1`,
      [base64Data, mimeType, userId],
      `uploading ${type} image`,
    );
  }

  async deleteImage(type: ImageType, userId: string): Promise<void> {
    const columns = IMAGE_TYPE_COLUMNS[type];
    if (!columns) {
      throw this.createValidationError('Invalid image type', 'type', type);
    }

    await this.executeQuery(
      `UPDATE branding_settings SET ${columns.data} = NULL, ${columns.mime} = NULL, updated_at = NOW(), updated_by = $1 WHERE id = 1`,
      [userId],
      `deleting ${type} image`,
    );
  }

  async getImage(type: ImageType): Promise<BrandingImage | null> {
    const columns = IMAGE_TYPE_COLUMNS[type];
    if (!columns) {
      return null;
    }

    const row = await this.executeQueryOne<Record<string, any>>(
      `SELECT ${columns.data} as data, ${columns.mime} as mime_type FROM branding_settings WHERE id = 1`,
      [],
      `getting ${type} image`,
    );

    if (!row || !row.data || !row.mime_type) {
      return null;
    }

    return {
      data: Buffer.from(row.data, 'base64'),
      mimeType: row.mime_type,
    };
  }
}
