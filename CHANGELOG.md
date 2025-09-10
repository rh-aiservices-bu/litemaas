# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
