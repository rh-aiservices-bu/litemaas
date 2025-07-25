# LiteMaaS - LiteLLM Model as a Service

A user-friendly application for interacting with LiteLLM, providing model discovery, subscription management, and usage analytics.

## Features

- 🔐 **OpenShift OAuth Authentication** - Secure authentication using OpenShift OAuth provider
- 🔍 **Model Discovery** - Browse and search available models through LiteLLM
- 🔑 **API Key Management** - Generate and manage API keys with budget tracking
- 👥 **Team Management** - Multi-tenant team support with shared budgets
- 💰 **Budget Control** - Multi-level budget management (user, team, subscription)
- 📊 **Usage Analytics** - Real-time cost tracking and usage visualization
- 🔄 **LiteLLM Integration** - Automated model synchronization with real-time updates
- 🚨 **Smart Alerting** - Automated budget alerts and usage monitoring
- 🚀 **Modern Stack** - Built with Fastify, React, and PatternFly 6

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL database
- Access to OpenShift OAuth provider
- LiteLLM instance

## Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd litemaas
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

4. Start development servers:
```bash
npm run dev
```

## Project Structure

```
litemaas/
├── backend/          # Fastify backend service
├── frontend/         # React frontend application
├── docs/            # Documentation
└── deployment/      # Kubernetes/OpenShift manifests
```

## Development

- `npm run dev` - Start both backend and frontend in development mode
- `npm run build` - Build both applications for production
- `npm run test` - Run tests for all workspaces
- `npm run lint` - Lint all workspaces

## Documentation

### Core Documentation
- **[CLAUDE.md](./CLAUDE.md)** - Complete project overview and architecture guide
- **[PATTERNFLY6_RULES.md](./PATTERNFLY6_RULES.md)** - PatternFly 6 migration and usage guidelines

### API Documentation
- **[Model Sync API](./backend/docs/MODEL_SYNC_API.md)** - Model synchronization endpoints and usage
- **[Model Sync Configuration](./backend/docs/MODEL_SYNC_CONFIG.md)** - Configuration guide for model synchronization
- **[Swagger UI](http://localhost:8080/docs)** - Interactive API documentation (when backend running)

### Features
- **Automatic Model Sync** - Models are synchronized from LiteLLM on application startup
- **Manual Sync API** - Admin endpoints for on-demand model synchronization
- **Database Migrations** - Automatic schema management and upgrades
- **Health Monitoring** - Comprehensive health checks and system status

## License

[License information to be added]