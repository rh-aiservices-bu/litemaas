# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
