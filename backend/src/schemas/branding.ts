import { Type } from '@sinclair/typebox';

/**
 * Branding image type parameter
 */
export const BrandingImageTypeSchema = Type.Union([
  Type.Literal('login-logo'),
  Type.Literal('header-brand-light'),
  Type.Literal('header-brand-dark'),
]);

/**
 * Branding image type params
 */
export const BrandingImageParamsSchema = Type.Object({
  type: BrandingImageTypeSchema,
});

/**
 * Branding settings response (no image data)
 */
export const BrandingSettingsSchema = Type.Object({
  loginLogoEnabled: Type.Boolean(),
  hasLoginLogo: Type.Boolean(),
  loginTitleEnabled: Type.Boolean(),
  loginTitle: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  loginSubtitleEnabled: Type.Boolean(),
  loginSubtitle: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  headerBrandEnabled: Type.Boolean(),
  hasHeaderBrandLight: Type.Boolean(),
  hasHeaderBrandDark: Type.Boolean(),
  updatedAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

/**
 * Update branding settings request (toggles and text only)
 */
export const UpdateBrandingSettingsSchema = Type.Object({
  loginLogoEnabled: Type.Optional(Type.Boolean()),
  loginTitleEnabled: Type.Optional(Type.Boolean()),
  loginTitle: Type.Optional(Type.Union([Type.String({ maxLength: 200 }), Type.Null()])),
  loginSubtitleEnabled: Type.Optional(Type.Boolean()),
  loginSubtitle: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  headerBrandEnabled: Type.Optional(Type.Boolean()),
});

/**
 * Upload branding image request
 */
export const UploadBrandingImageSchema = Type.Object({
  data: Type.String({ description: 'Base64-encoded image data' }),
  mimeType: Type.String({ description: 'Image MIME type' }),
});

/**
 * Branding error response
 */
export const BrandingErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
  }),
  requestId: Type.Optional(Type.String()),
});
