# Branding Customization

## Overview

Branding Customization allows administrators to personalize the LiteMaaS login page and application header with custom logos, titles, and subtitles. Each element can be independently enabled or disabled, providing fine-grained control over the application's visual identity.

## Key Features

- **Toggle-based control**: Each branding element has an independent enable/disable switch, allowing administrators to customize selectively
- **Image constraints**: Uploaded images are limited to 2 MB and must be one of the supported formats (JPEG, PNG, SVG, GIF, WebP)
- **Fallback behavior**: When a branding element is disabled or not configured, the application falls back to its default appearance
- **Theme support**: Header brand supports separate light and dark theme logos, automatically displayed based on the active theme
- **Cache-busting**: Image URLs include an `updatedAt` query parameter to ensure browsers display the latest version after changes
- **Singleton pattern**: A single database row stores all branding settings, ensuring consistency across the application

## RBAC Permissions

| Action | Required Role | Description |
|--------|--------------|-------------|
| View branding settings | Public | Login page branding is visible to all users (unauthenticated) |
| View branding admin UI | admin, adminReadonly | Access the Branding tab in Admin Tools |
| Modify branding settings | admin | Update toggles, text, upload/delete images |

## Customizable Elements

| Element | Type | Constraints | Description |
|---------|------|-------------|-------------|
| Login Logo | Image | 2 MB max, JPEG/PNG/SVG/GIF/WebP | Custom logo displayed on the login page |
| Login Title | Text | 200 characters max | Custom title text on the login page |
| Login Subtitle | Text | 500 characters max | Custom subtitle text on the login page |
| Header Brand (Light) | Image | 2 MB max, JPEG/PNG/SVG/GIF/WebP | Application header logo for light theme |
| Header Brand (Dark) | Image | 2 MB max, JPEG/PNG/SVG/GIF/WebP | Application header logo for dark theme |

## UI Components

### BrandingTab

The `BrandingTab` component (`frontend/src/components/branding/BrandingTab.tsx`) is rendered within the Admin Tools page (`/admin/tools`). It provides a card-based layout with four sections:

1. **Login Logo Card** — Toggle switch + image upload/preview/delete
2. **Login Title Card** — Toggle switch + text input (max 200 characters)
3. **Login Subtitle Card** — Toggle switch + textarea (max 500 characters)
4. **Header Brand Card** — Toggle switch + separate upload areas for light and dark theme logos

A **Save** button at the bottom persists toggle and text changes. Image uploads take effect immediately upon file selection.

### BrandingContext

The `BrandingContext` (`frontend/src/contexts/BrandingContext.tsx`) provides branding settings to the entire application via React Context and React Query:

- **Query key**: `['brandingSettings']`
- **Stale time**: 5 minutes
- **Cache time**: 10 minutes
- **Error behavior**: Falls back to default settings (all disabled) on fetch failure
- **Refetch**: Triggered after any branding update via `refetch()` from the context

## Technical Details

### Database

Branding settings are stored in a singleton `branding_settings` table with a `CHECK (id = 1)` constraint ensuring only one row exists. Image data is stored as base64-encoded text alongside its MIME type. See [Database Schema](../architecture/database-schema.md#branding_settings) for the full table definition.

### Backend Service

`BrandingService` (`backend/src/services/branding.service.ts`) extends `BaseService` and provides:

- `getSettings()` — Returns metadata (toggles, text, hasImage flags) without image data
- `updateSettings()` — Updates toggles and text fields
- `uploadImage()` — Validates and stores a base64-encoded image
- `deleteImage()` — Removes an image (sets data and MIME type to NULL)
- `getImage()` — Returns binary image data with proper Content-Type header

### API Endpoints

Five endpoints under `/api/v1/branding`. See [REST API Reference](../api/rest-api.md#branding-apiv1branding) for full request/response documentation.

### Image Storage

Images are stored as base64 text in the database. When served via the `GET /images/:type` endpoint, they are decoded to binary and returned with the appropriate `Content-Type` header and a 1-hour `Cache-Control` header.

## Related Documentation

- [Admin Tools](admin-tools.md#branding-customization) — Branding section in admin tools guide
- [REST API Reference](../api/rest-api.md#branding-apiv1branding) — Branding API endpoints
- [Database Schema](../architecture/database-schema.md#branding_settings) — Table definition
