import { Type } from '@sinclair/typebox';
import { TimestampSchema } from './common';

/**
 * Banner content schema - supports multiple languages
 */
export const BannerContentSchema = Type.Record(Type.String(), Type.String({ maxLength: 500 }), {
  description: 'Banner content in multiple languages (key: language code, value: text)',
});

/**
 * Banner variant enum
 */
export const BannerVariantSchema = Type.Union([
  Type.Literal('info'),
  Type.Literal('warning'),
  Type.Literal('danger'),
  Type.Literal('success'),
  Type.Literal('default'),
]);

/**
 * Full banner schema
 */
export const BannerSchema = Type.Object({
  id: Type.String(),
  name: Type.String({ minLength: 1, maxLength: 100 }),
  isActive: Type.Boolean(),
  priority: Type.Integer({ minimum: 0 }),
  content: BannerContentSchema,
  variant: BannerVariantSchema,
  isDismissible: Type.Boolean(),
  dismissDurationHours: Type.Optional(Type.Integer({ minimum: 1 })),
  startDate: Type.Optional(TimestampSchema),
  endDate: Type.Optional(TimestampSchema),
  targetRoles: Type.Optional(Type.Array(Type.String())),
  targetUserIds: Type.Optional(Type.Array(Type.String())),
  linkUrl: Type.Optional(Type.String({ format: 'uri', maxLength: 500 })),
  linkText: Type.Optional(BannerContentSchema),
  markdownEnabled: Type.Boolean(),
  createdBy: Type.Optional(Type.String()),
  updatedBy: Type.Optional(Type.String()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

/**
 * Create banner request schema
 */
export const CreateBannerSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  content: BannerContentSchema,
  variant: Type.Optional(BannerVariantSchema),
  isActive: Type.Optional(Type.Boolean()),
  isDismissible: Type.Optional(Type.Boolean()),
  dismissDurationHours: Type.Optional(Type.Integer({ minimum: 1 })),
  startDate: Type.Optional(TimestampSchema),
  endDate: Type.Optional(TimestampSchema),
  targetRoles: Type.Optional(Type.Array(Type.String())),
  targetUserIds: Type.Optional(Type.Array(Type.String())),
  linkUrl: Type.Optional(Type.String({ format: 'uri', maxLength: 500 })),
  linkText: Type.Optional(BannerContentSchema),
  markdownEnabled: Type.Optional(Type.Boolean()),
});

/**
 * Update banner request schema
 */
export const UpdateBannerSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  isActive: Type.Optional(Type.Boolean()),
  content: Type.Optional(BannerContentSchema),
  variant: Type.Optional(BannerVariantSchema),
  isDismissible: Type.Optional(Type.Boolean()),
  dismissDurationHours: Type.Optional(Type.Integer({ minimum: 1 })),
  startDate: Type.Optional(TimestampSchema),
  endDate: Type.Optional(TimestampSchema),
  targetRoles: Type.Optional(Type.Array(Type.String())),
  targetUserIds: Type.Optional(Type.Array(Type.String())),
  linkUrl: Type.Optional(Type.String({ format: 'uri', maxLength: 500 })),
  linkText: Type.Optional(BannerContentSchema),
  markdownEnabled: Type.Optional(Type.Boolean()),
});

/**
 * Banner audit log schema
 */
export const BannerAuditLogSchema = Type.Object({
  id: Type.String(),
  bannerId: Type.String(),
  action: Type.Union([
    Type.Literal('create'),
    Type.Literal('update'),
    Type.Literal('delete'),
    Type.Literal('activate'),
    Type.Literal('deactivate'),
  ]),
  changedBy: Type.Optional(Type.String()),
  previousState: Type.Optional(Type.Record(Type.String(), Type.Any())),
  newState: Type.Optional(Type.Record(Type.String(), Type.Any())),
  changedAt: TimestampSchema,
});

/**
 * User banner dismissal schema
 */
export const UserBannerDismissalSchema = Type.Object({
  userId: Type.String(),
  bannerId: Type.String(),
  dismissedAt: TimestampSchema,
});

/**
 * Banner list response schema
 */
export const BannerListResponseSchema = Type.Object({
  banners: Type.Array(BannerSchema),
  total: Type.Integer(),
});

/**
 * Banner audit log list response schema
 */
export const BannerAuditLogListResponseSchema = Type.Object({
  auditLogs: Type.Array(BannerAuditLogSchema),
  total: Type.Integer(),
});

/**
 * URL parameter schemas
 */
export const BannerIdParamSchema = Type.Object({
  id: Type.String({ description: 'Banner ID' }),
});

/**
 * Query parameter schemas
 */
export const BannerQuerySchema = Type.Object({
  active: Type.Optional(Type.Boolean({ description: 'Filter by active status' })),
  variant: Type.Optional(BannerVariantSchema),
});

/**
 * Success response schemas
 */
export const BannerCreatedResponseSchema = Type.Object({
  banner: BannerSchema,
  message: Type.String(),
});

export const BannerUpdatedResponseSchema = Type.Object({
  banner: BannerSchema,
  message: Type.String(),
});

export const BannerDeletedResponseSchema = Type.Object({
  message: Type.String(),
});

export const BannerDismissedResponseSchema = Type.Object({
  message: Type.String(),
});

/**
 * Validation for simplified banner management (most common use case)
 */
export const SimpleBannerUpdateSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  isActive: Type.Boolean(),
  content: BannerContentSchema,
  variant: Type.Optional(BannerVariantSchema),
  isDismissible: Type.Optional(Type.Boolean()),
  markdownEnabled: Type.Optional(Type.Boolean()),
});

/**
 * Bulk visibility update request schema
 */
export const BulkVisibilityUpdateSchema = Type.Record(Type.String(), Type.Boolean(), {
  description: 'Map of banner IDs to visibility states (true = active, false = inactive)',
});

/**
 * Bulk visibility update response schema
 */
export const BulkVisibilityUpdateResponseSchema = Type.Object({
  message: Type.String(),
});
