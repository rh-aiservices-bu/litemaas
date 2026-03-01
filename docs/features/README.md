# Features Documentation

This directory contains documentation for key features and functionality in LiteMaaS.

## Core Features

- **[User Roles & Administration](user-roles-administration.md)** - RBAC system with three-tier role hierarchy (admin > adminReadonly > user)
- **[Admin Tools](admin-tools.md)** - Administrative tools and model synchronization
- **[Branding Customization](branding-customization.md)** - Custom login page and header branding for administrators
- **[Authentication Flow](authentication-flow.md)** - OAuth2 integration and authentication details
- **[Restricted Model Subscription Approval](subscription-approval-workflow.md)** - Admin approval workflow for restricted model access with audit trail
- **[Admin Usage API Key Filter](admin-usage-api-key-filter.md)** - Filtering usage data by API keys
- **[Model Configuration Testing](model-configuration-testing.md)** - Configuration validation and testing features
- **[Admin Tools — API Key Quota Defaults](admin-tools.md#api-key-quota-defaults)** - Admin-configurable defaults and maximums for user self-service API key quotas
- **[Test Chatbot](test-chatbot.md)** - Chatbot testing guide and features

## Feature Categories

### Administration & Access Control

- Role-based access control (RBAC)
- User management
- Admin tools and dashboards
- Branding customization (login logo, title, subtitle, header brand)

### Model Management

- Model synchronization with LiteLLM
- Model configuration and testing
- API key management (multi-model support)
- Self-service API key quotas with admin-controlled defaults and maximums

### AI Integration

- Test chatbot functionality
- Model proxy integration
- Usage analytics

## Related Documentation

- [API Reference](../api/README.md) - API endpoints for features
- [Development Guide](../development/setup.md) - Implementing new features
- [Architecture](../architecture/README.md) - System design
- [Deployment](../deployment/README.md) - Feature configuration
