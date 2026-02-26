# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Branding Customization**: Admin-controlled login page and application header branding with per-element toggle switches
  - Login page customization: custom logo, title (200 char max), and subtitle (500 char max)
  - Header brand: separate light and dark theme logos for automatic theme-aware display
  - New `branding_settings` singleton database table with `CHECK (id = 1)` constraint
  - New `BrandingService` extending `BaseService` with image validation (2 MB max, JPEG/PNG/SVG/GIF/WebP)
  - Five API endpoints under `/api/v1/branding` (public GET for settings/images, admin PATCH/PUT/DELETE for modifications)
  - New `BrandingContext` with React Query (5-min stale time, graceful fallback to defaults)
  - New `BrandingTab` component with card-based layout in Admin Tools page
  - Image storage as base64 in database with binary serving via proper Content-Type headers
  - Cache-busting via `updatedAt` query parameter on image URLs
  - RBAC: public read access for login page, `admin:banners:write` for modifications, adminReadonly for viewing admin UI

- **Per-Key Budget and Rate Limits**: Granular per-API-key budget and rate limit management exposed through the admin user management interface
  - Budget controls: `max_budget`, `budget_duration` (30s, 1h, 1d, 7d, 30d, 1mo), `soft_budget`, and real-time `budget_utilization` tracking
  - Rate limits: per-key `tpm_limit` and `rpm_limit` with display in admin key table
  - Advanced limits: `max_parallel_requests` for concurrent request caps
  - Per-model granularity: `model_max_budget`, `model_rpm_limit`, and `model_tpm_limit` with BudgetConfig format
  - New database columns on `api_keys` table: `budget_duration`, `soft_budget`, `budget_reset_at`, `max_parallel_requests`, `model_max_budget`, `model_rpm_limit`, `model_tpm_limit`
  - Admin UI: budget/rate limit fields in key creation form, utilization progress bars and limit labels in key table
  - Full LiteLLM synchronization: fields passed on key create/update and synced back on read
  - i18n support across all 9 locales

- **Encrypted API Key Storage & Edit-Mode Testing**: Provider API keys are now stored encrypted (AES-256-GCM) in the LiteMaaS database, enabling admins to test model configuration during editing without re-entering the API key
  - New `encrypted_api_key` column on `models` table stores keys encrypted with `LITELLM_MASTER_KEY` (falls back to `LITELLM_API_KEY`)
  - New `LITELLM_MASTER_KEY` environment variable for encryption key derivation (optional, recommended for production)
  - Test Configuration button is now enabled in edit mode without an API key; create mode still requires one
  - Graceful fallback for models created before this feature: warns the admin to enter an API key manually
  - New `encryption.ts` utility with `encryptApiKey` / `decryptApiKey` using AES-256-GCM (random IV, auth tag, base64-encoded)
  - New `missing_stored_key` result type for the test configuration endpoint

### Changed

- **Login Page Default Logo**: Replaced `LogoTitle` with new `Octobean` SVG as the default login page brand image
- **Fastify `trustProxy` Enabled**: Added `trustProxy: true` to Fastify configuration for correct protocol detection behind edge TLS termination proxies

### Fixed

- **Model Configuration Testing Security**: Moved model endpoint connectivity testing from browser-side to backend
  - New `POST /api/v1/admin/models/test` endpoint with authentication and RBAC (`admin:models` permission)
  - API keys are no longer exposed in browser network requests during configuration tests
  - Backend-side 10-second timeout with AbortController for reliable connection handling
  - Structured result types: `model_found`, `model_not_found`, `auth_error`, `connection_error`, `timeout`

- **Health Check Compatibility with LiteLLM v1.81.0**: Fixed health check to handle both JSON and plain text responses from `/health/liveness`
  - LiteLLM v1.81.0 returns plain text `I'm alive!` instead of JSON
  - `makeRequest()` now detects content-type and parses accordingly, preserving circuit breaker, retry, and logging infrastructure

- **Per-Key Quota Bug Fixes**: Multiple fixes for per-key budget and rate limit handling
  - Fixed falsy value coercion: `|| null` → `?? null` for `softBudget`, `maxParallelRequests`, and `budgetDuration` to prevent `0` being treated as empty
  - Fixed `budgetUtilization` returning `undefined` when `current_spend` is `0` and division by zero when `max_budget` is `0`
  - Fixed missing per-key quota fields in admin `GET /:id/api-keys` response mapping
  - Replaced `Type.Any()` with properly typed `Record` schemas in admin-users response
  - Extracted shared `ApiKeyDbRow` type to propagate new columns through all call sites
  - Conditional UI: budget duration and soft budget fields only shown when max budget > 0

### Documentation

- New: `docs/features/branding-customization.md` — Branding customization feature guide
- Updated: `docs/features/model-configuration-testing.md` — Server-side testing and encrypted key storage
- Updated: `docs/api/rest-api.md` — Branding and model test endpoints
- Updated: `docs/architecture/database-schema.md` — New branding_settings and api_keys columns

### Infrastructure

- **Testing**: New backend unit tests for API key service quota fields, budget utilization edge cases, and sync transforms
- **Testing**: New frontend tests for budget/rate limit columns and conditional form fields in UserApiKeysTab

---

## [0.2.0] - 2026-02-13

### Added

- **Admin User Management**: Consolidated admin interface for viewing and managing users through a modal-based workflow with tabbed views
  - **Unified Management Modal**: Single modal with Profile, Budget & Limits, API Keys, and Subscriptions tabs for complete user management
  - **Role Management**: Toggle user/admin/adminReadonly roles with conflict detection (warns if both admin and admin-readonly are selected)
  - **Budget & Rate Limits**: Configure max budget, TPM, and RPM limits with real-time utilization tracking and color-coded progress bars
  - **API Key Lifecycle**: Create, view, and revoke API keys for users with auto-subscription creation for associated models
  - **Subscription Visibility**: View all user subscriptions with status and reason tracking
  - **Full Audit Trail**: All admin actions logged with admin user ID, target user, and metadata
  - **RBAC**: `users:read` (admin, adminReadonly) for viewing, `users:write` (admin only) for modifications
  - **AdminReadonly Support**: Read-only users can view all details but cannot modify budget/limits, create/revoke keys, or toggle roles

### Changed

- **LiteLLM upgraded to v1.81.0**: Bundled LiteLLM proxy updated from v1.74.x to v1.81.0 with backward-compatible API handling. Requires a two-phase deployment -- see the [Upgrade Guide for v0.2.0](docs/deployment/upgrading-to-v0.2.md).
- **Helm Chart Defaults**: Default platform set to OpenShift (`global.platform: openshift`)
- **Helm Chart Defaults**: LiteLLM Route and Ingress now enabled by default (`route.litellm.enabled: true`, `ingress.litellm.enabled: true`), since LiteLLM shares the same Service/endpoints as the frontend and should be exposed when the frontend is. Set to `false` to keep LiteLLM cluster-internal only.
- **Helm Deployment Docs**: Simplified Quick Start examples and updated configuration reference tables to reflect new defaults

### Fixed

- **Admin API Key Revocation**: Fixed schema validation and audit log overflow issues in admin API key management
- **Helm: LiteLLM URL uses external Route/Ingress when available**: `LITELLM_API_URL` now resolves to the external Route or Ingress URL instead of the internal ClusterIP address when external access is enabled, so users see a reachable endpoint in the UI
  - Kubernetes Ingress: uses `https://` or `http://` based on TLS configuration
  - OpenShift Route with explicit host: uses `https://<host>`
  - OpenShift Route with auto-generated host: derived from `clusterDomain` or patched at runtime by the post-install hook
  - Explicit `backend.litellmApiUrl` override still takes precedence
  - `LITELLM_API_URL` moved from Deployment env to ConfigMap to enable hook patching
  - Post-install hook RBAC extended with configmaps get/patch permission
  - NOTES.txt now shows LiteLLM URL in the OpenShift access section

### Documentation

- New: `docs/features/users-management.md` — Admin user management feature guide
- New: `docs/deployment/upgrading-to-v0.2.md` — Migration guide for upgrading existing deployments to v0.2.0

---

## [0.1.3] - 2026-02-11

This release introduces Helm chart deployment for Kubernetes and OpenShift, fixes special character handling in model names, and includes deployment improvements.

### Added

- **Helm Chart Deployment**: Full Helm chart for Kubernetes and OpenShift (`deployment/helm/litemaas/`)
  - Backend, frontend, LiteLLM, and PostgreSQL components
  - OpenShift Route and Kubernetes Ingress support
  - OAuth token patching post-install hook for OpenShift
  - ServiceAccount and RBAC configuration
  - Comprehensive `values.yaml` with sensible defaults
  - Helm chart documentation (`deployment/helm/README.md`)

- **`OPENSHIFT_API_URL` Environment Variable**: Manual override for the OpenShift API server URL
  - Supports customized OpenShift environments where automatic URL derivation from the OAuth issuer doesn't work
  - Falls back to existing auto-detection logic when unset

- **`INITIAL_ADMIN_USERS` Environment Variable**: Bootstrap admin users via comma-separated usernames
  - Grants admin + user roles to specified users on login
  - Useful for initial deployment where no OpenShift groups exist yet

### Fixed

- **Special Characters in Model Names**: Model IDs containing slashes (e.g., `RedHatAI/gpt-oss-120b`) now work correctly
  - Frontend URL-encodes model IDs when calling the backend API
  - Nginx `proxy_pass` corrected to avoid unintended URL rewriting
  - Added mock model with slash in name for development/testing

### Changed

- **Deployment Directory Renamed**: `deployment/openshift/` → `deployment/kustomize/` to better reflect the tooling used
- **Container Build Script**: Removed automatic `latest` tag — containers are now tagged with version only
- **Documentation Cleanup**: Removed ~30,000 lines of obsolete refactoring phase documentation (`docs/development/refactor/`)

### Documentation

- New: `docs/deployment/helm-deployment.md` — Comprehensive Helm deployment guide
- Renamed: `docs/deployment/openshift-deployment.md` → `docs/deployment/kustomize-deployment.md`
- Updated: deployment docs, authentication docs, and README to reflect Helm and Kustomize options

### Contributors

- Guillaume Moutier
- Co-authored-by: Claude (AI pair programming assistant)

---

## [0.1.2] - 2025-10-17

This patch release fixes a critical database migration issue that could prevent successful deployments.

### Fixed

- **Database Migration Resilience**: Fixed `litellm_key_alias` backfill migration to skip inactive API keys
  - Migration now filters for `is_active = true` to avoid processing inactive/revoked keys
  - Prevents 404 errors from LiteLLM when trying to fetch details for deleted keys
  - Eliminates circuit breaker opening after 5 consecutive failures
  - Ensures active keys are successfully processed during backfill operations
  - Added explanatory comment about skipping inactive keys

### Contributors

- Guillaume Moutier
- Co-authored-by: Claude (AI pair programming assistant)

---

## [0.1.1] - 2025-10-17

This patch release improves test reliability, server startup performance, and handles edge cases in database migrations.

### Fixed

- **Orphaned API Key Handling**: Backend now gracefully handles API keys that exist in the database but were deleted in LiteLLM
  - Database migration marks orphaned keys with `orphaned_` prefix instead of failing
  - Eliminates verbose error logging during backfill operations
  - Prevents migration failures due to missing keys in LiteLLM
  - Improved error handling for 404 responses during key synchronization

- **Server Startup Performance**: Backend initialization is now faster and more resilient
  - Moved LiteLLM-dependent operations to background tasks using `setImmediate`
  - Server starts immediately without waiting for external service operations
  - Non-blocking initialization prevents startup delays
  - Better handling of external service availability during boot

- **Frontend Test Reliability**: Fixed missing mock endpoint causing test failures
  - Added `/api/v1/banners` mock endpoint to test handlers
  - BannerProvider now works correctly in Layout component tests
  - Eliminated test failures related to banner initialization

- **Configuration**: Minor backend configuration adjustments
  - Updated admin analytics configuration handling
  - Package dependency updates

### Documentation

- Updated deployment version examples in OpenShift configuration
  - `deployment/openshift/README.md` updated with v0.1.0 reference
  - `deployment/openshift/user-values.env.example` synchronized

### Contributors

- Guillaume Moutier
- Co-authored-by: Claude (AI pair programming assistant)

---

## [0.1.0] - 2025-10-17

This is a significant milestone release introducing three major enterprise-grade features that fundamentally expand the platform's capabilities for model governance, system observability, and operational efficiency.

### Added

- **Restricted Model Subscription Approval Workflow**: Enterprise-grade approval system for controlling access to sensitive or costly AI models
  - Three-state workflow (pending, active, denied) with comprehensive review capabilities
  - Bulk approval/denial operations with detailed result tracking and validation
  - Complete audit trail via new `subscription_status_history` database table
  - Automatic cascade behavior when models become restricted (existing subscriptions → pending)
  - LiteLLM API key synchronization on access changes for immediate enforcement
  - Granular RBAC: admin can approve/deny/delete, adminReadonly can view only
  - Rich filtering by status, model, provider, and user
  - Admin subscription management API endpoints (`/api/v1/admin/subscriptions`)
  - AdminSubscriptionsPage with intuitive bulk operations interface
  - Notification service for subscription status changes
  - Restricted model flagging in admin models interface
  - Full internationalization support across 9 languages
  - Comprehensive test coverage (integration and unit tests)
  - Complete documentation: feature guide and detailed implementation specification

- **Comprehensive Admin Usage Analytics System**: Enterprise-grade analytics providing system-wide usage visibility and insights
  - Multi-dimensional filtering: users, models, providers, API keys with cascading dependencies
  - Configurable date range selection with validation
  - Day-by-day incremental caching strategy (permanent historical + 5-min current day TTL)
  - Intelligent trend analysis with automatic comparison period calculations
  - Rich visualizations:
    - Usage trends over time (requests, tokens, costs)
    - Model distribution pie charts
    - Provider breakdown tables
    - Weekly usage heatmap (component ready, full integration pending)
  - Data export functionality (CSV/JSON) with filter preservation
  - Configurable cache TTL via ConfigContext integration with React Query
  - AdminUsagePage with Overview/Models/Users/Heatmap tabs
  - New backend services:
    - AdminUsageStatsService (2,833 lines) - Main analytics engine
    - DailyUsageCacheManager (549 lines) - Incremental caching system
    - Specialized modules: aggregation, enrichment, export, trend calculation
  - Admin usage API endpoints (`/api/v1/admin/usage`) with comprehensive RBAC
  - Reusable filter components: DateRangeFilter, ModelFilterSelect, UserFilterSelect, ApiKeyFilterSelect
  - Shared chart utilities for consistent formatting, accessibility, and styling
  - Full-screen chart modal for detailed visualization
  - Extensive test coverage (70%+ backend, comprehensive frontend tests)
  - Complete documentation: 2,000-line implementation plan, chart components guide, testing patterns

- **Model Configuration Testing with Real-Time Validation**: Administrator quality-of-life improvement
  - "Test Configuration" button in model creation interface
  - Real-time validation of API endpoint and credentials before model creation
  - Model availability checking at specified endpoint
  - Display of available models when requested model is not found
  - Comprehensive error handling with user-friendly feedback
  - Clear error messages for authentication failures and network issues
  - Test results cleared automatically when configuration fields change
  - Internationalization support across 9 languages
  - Reduces failed model creation attempts and improves administrative UX

- **Infrastructure and Tooling**:
  - Add ConfigContext for frontend configuration management
  - Add notification service for system-wide event notifications
  - Add pagination utilities for consistent API pagination patterns
  - Add advisory lock utilities for database concurrency control
  - Add date validation utilities with comprehensive timezone handling
  - Add database migration for fixing token breakdown calculations in daily usage cache
  - Add rate limiting configuration for admin analytics endpoints
  - Add recalculate-usage-cache.ts script for cache management
  - Enhanced development workflow with improved logging scripts

### Changed

- **Backend Architecture**: Major refactoring of admin analytics service
  - Decomposed monolithic AdminUsageStatsService into specialized modules
  - Created separate services for aggregation, enrichment, export, and trend calculation
  - Improved separation of concerns and code maintainability
  - Better testability with focused unit tests per module
  - Reduced cognitive complexity while maintaining functionality

- **Subscription Service**: Extended with approval workflow logic
  - Added status management (pending, active, denied)
  - Implemented approval/denial operations with reason tracking
  - Added bulk operations support with transaction management
  - Enhanced subscription filtering capabilities
  - Improved subscription status history tracking

- **API Key Service**: Enhanced for subscription approval integration
  - Improved LiteLLM synchronization on subscription status changes
  - Better handling of model access changes
  - Enhanced error handling and validation

- **Configuration Management**: Extended with analytics-specific settings
  - Added cache TTL configuration options
  - Added rate limiting configuration for admin endpoints
  - Enhanced frontend config service with backend configuration integration

- **Frontend State Management**: Improved with new context providers
  - Added ConfigContext for dynamic backend configuration
  - Enhanced React Query integration with configurable cache TTL
  - Better state management for complex filter interactions

### Fixed

- **OAuth TLS Verification**: Add optional TLS verification bypass for Kubernetes API
  - New `K8S_SKIP_TLS_VERIFY` environment variable for self-signed certificate environments
  - Improved OAuth service configuration flexibility
  - Better support for development and testing environments with self-signed certs

- **Daily Usage Cache Token Breakdowns**: Fixed token calculation accuracy
  - Database migration to correct token breakdown aggregation
  - Improved data integrity for usage statistics
  - More accurate cost calculations and reporting

### Documentation

- **Comprehensive Feature Documentation**:
  - New: `docs/features/subscription-approval-workflow.md` (446 lines) - Complete workflow guide
  - New: `docs/features/restricted-model-subscription-approval.md` (2,432 lines) - Detailed implementation spec
  - New: `docs/features/admin-usage-analytics-implementation-plan.md` (2,000+ lines) - Complete analytics implementation guide
  - New: `docs/features/model-configuration-testing.md` (172 lines) - Testing feature guide
  - New: `docs/features/admin-usage-api-key-filter.md` (842 lines) - API key filtering implementation
  - New: `docs/future-enhancements/weekly-usage-heatmap.md` (765 lines) - Heatmap feature specification

- **Development Documentation**:
  - New: `docs/development/pattern-reference.md` (1,398 lines) - Authoritative code patterns and anti-patterns
  - New: `docs/development/chart-components-guide.md` (644 lines) - Chart component patterns and utilities
  - New: `docs/development/code-review-checklist.md` (518 lines) - Comprehensive review guide
  - New: `docs/development/error-handling-guide.md` (813 lines) - Error handling best practices
  - New: `docs/development/concurrency-strategy.md` (491 lines) - Concurrency patterns
  - Enhanced: `docs/development/pf6-guide/` - Testing patterns, troubleshooting, and resources

- **Architecture Documentation**:
  - New: `docs/architecture/project-structure.md` (295 lines) - Complete directory structure
  - Enhanced: `docs/architecture/database-schema.md` - Updated with new tables and fields
  - Enhanced: `docs/architecture/services.md` - Updated with new services and patterns

- **API Documentation**:
  - Enhanced: `docs/api/rest-api.md` - Added admin subscription and usage endpoints
  - Enhanced: `docs/api/usage-api.md` - Updated with admin analytics API details

- **AI Assistant Context**:
  - Enhanced: `CLAUDE.md` - Updated with new features and patterns
  - Enhanced: `backend/CLAUDE.md` - Updated with service layer changes
  - Enhanced: `frontend/CLAUDE.md` - Updated with new components and patterns
  - Enhanced: `.claude/agents/` - Updated agent specifications with project context

- **Deployment and Configuration**:
  - Enhanced: `docs/deployment/configuration.md` - Added new environment variables
  - New: `deployment/openshift/VALIDATION.md` (529 lines) - Deployment validation guide

- **Refactoring Documentation**:
  - Comprehensive refactoring session documentation in `docs/development/refactor/`
  - Phase-by-phase guides for admin analytics refactoring
  - Database optimization and performance testing guides
  - Future enhancement planning (Redis caching, async export, scheduled reports)

### Infrastructure

- **Testing Infrastructure**: Significantly enhanced test coverage
  - New: Backend integration tests for admin subscriptions (514 lines)
  - New: Backend integration tests for admin usage (537 lines + 706 lines pagination)
  - New: Backend unit tests for admin usage services (1,850+ lines)
  - New: Frontend component tests for admin pages and features
  - Enhanced: Test helpers and utilities for better test organization
  - Added: Database reset utilities for test isolation
  - Added: Test configuration management
  - Improved: Test coverage reporting and monitoring

- **Database Schema**: Extended with new tables and fields
  - New table: `subscription_status_history` for audit trail
  - New fields: `subscriptions.status` (pending/active/denied)
  - New fields: `subscriptions.denied_reason`, `subscriptions.denied_at`, `subscriptions.denied_by_user_id`
  - New fields: `models.is_restricted` for restricted model flagging
  - Migration: Token breakdown calculation fixes in daily usage cache

- **Development Tools**:
  - New: `dev-tools/run_with_stderr.sh` - Stderr capture workaround for Bash tool
  - New: `dev-tools/fix-seed-data-tokens.py` - Database maintenance utility
  - Enhanced: Logging scripts for development workflow
  - Added: Package.json scripts for log management (`logs:backend`, `logs:frontend`, `logs:all`, `logs:clear`)

### Performance

- **Caching Strategy**: Intelligent multi-tier caching for admin analytics
  - Permanent caching for historical data (immutable)
  - 5-minute TTL for current day data (near real-time)
  - Day-by-day incremental cache building
  - Configurable cache TTL via backend configuration
  - Significant performance improvement for large-scale analytics queries

- **Database Optimization**: Improved query patterns and indexing
  - Advisory locks for concurrency control
  - Transaction management for bulk operations
  - Efficient aggregation queries for usage statistics

### Security

- **Enhanced RBAC**: Granular permissions for new features
  - Admin subscription management (admin only for write, adminReadonly for read)
  - Admin usage analytics (admin and adminReadonly for read)
  - Proper authorization checks in all new endpoints
  - Comprehensive permission testing

- **API Key Management**: Improved security for subscription changes
  - Immediate LiteLLM synchronization on access revocation
  - Proper cleanup of API keys when subscriptions denied
  - Audit trail for all subscription status changes

### Contributors

- Guillaume Moutier
- Co-authored-by: Claude (AI pair programming assistant)

---

## [0.0.19] - 2025-09-14

### Added

- **Comprehensive Error Handling Architecture**: Complete error handling system across backend and frontend
  - New `ApplicationError` class with standardized error codes and user-friendly messages
  - `useErrorHandler` React hook for consistent error processing and notifications
  - Error handling middleware with enhanced logging and debugging capabilities
  - Circuit breaker patterns for resilient external service communication
- **Error UI Components**: User-friendly error display components
  - `ErrorAlert` component for displaying error notifications with accessibility support
  - `FieldErrors` component for form validation error display
  - Integration with notification system for consistent error messaging
- **Error Handling Utilities**: Comprehensive backend error processing tools
  - Database error mapping and transformation utilities
  - Service-level error handling patterns in `BaseService`
  - API endpoint error standardization across all routes
- **Testing Infrastructure**: Extensive test coverage for error handling
  - Integration tests for error flows and edge cases
  - Unit tests for error utilities and components
  - Error scenario testing across all services and components

### Enhanced

- **Internationalization**: Error message support across all 9 languages
  - Added error-specific translation keys for EN, ES, FR, DE, IT, JA, KO, ZH, ELV
  - Localized error messages for consistent user experience
- **Service Layer**: Improved error handling in all backend services
  - Enhanced `BaseService` with standardized error patterns
  - Improved database error handling and transaction management
  - Better validation error messages and field-specific feedback
- **API Endpoints**: Consistent error responses across all routes
  - Standardized error response format with proper HTTP status codes
  - Enhanced validation error reporting with field-level details
  - Improved error logging for debugging and monitoring

### Fixed

- **Issue #50**: Resolved specific bug reported in GitHub issue
- **Database Migration**: Fixed database migration utilities and error handling
- **Rate Limiting**: Improved rate limiting error messages and handling
- **Subscription Service**: Enhanced error handling in subscription management
- **API Key Service**: Better error handling for API key operations

### Documentation

- **Error Handling Guide**: Comprehensive developer documentation for error handling patterns
- **Architecture Documentation**: Detailed error handling architecture specification
- **Development Context**: Updated CLAUDE.md files with error handling implementation details
- **API Documentation**: Updated with standardized error response formats

### Infrastructure

- **Deployment**: Updated OpenShift deployment configuration template
- **Environment**: Enhanced environment variable examples and configuration
- **Logging**: Improved error logging with structured output and debugging support

## [0.0.18] - 2024-08-25

### Added

- **Admin Model Management**: Complete administrative interface for managing AI models
  - New Admin Models page with comprehensive model CRUD operations
  - Backend admin model routes with full validation and error handling
  - Model creation, editing, and deletion capabilities for administrators
  - Integration tests for admin model management endpoints
- **Enhanced Model Features**: Extended model functionality and metadata
  - Added support for model vision capabilities, function calling, and tool choice
  - Enhanced model synchronization with LiteLLM integration
  - Additional model fields: API base, TPM/RPM limits, max tokens, backend model names
  - Improved model metadata handling and database schema migrations
- **User Interface Improvements**: Enhanced frontend components and navigation
  - Updated navigation with admin model management section
  - Improved model display with enhanced properties and status indicators
  - Added flair color utilities for better visual categorization
  - Enhanced subscription management with improved model integration

### Enhanced

- **Documentation Updates**: Comprehensive documentation improvements across the project
  - Updated API documentation with new admin endpoints
  - Enhanced deployment guides for OpenShift and container environments
  - Improved development setup instructions and authentication guides
  - Updated configuration documentation with new environment variables
- **Internationalization**: Updated translations across all supported languages (9 languages)
  - Added new translation keys for admin model management features
  - Synchronized translation files for consistent user experience
- **Development Experience**: Improved development workflow and configuration
  - Updated port configurations (8080 � 8081) for better consistency
  - Enhanced environment variable examples and Docker configuration
  - Improved TypeScript configuration and build processes

### Infrastructure

- **Database Schema**: Enhanced database structure for model management
  - Added new model fields for LiteLLM integration
  - Improved indexing for better query performance
  - Database migration scripts for seamless upgrades
- **Security & Testing**: Strengthened security and test coverage
  - Enhanced admin permission checks and audit logging
  - Comprehensive integration tests for new admin functionality
  - Improved error handling and validation across the stack
