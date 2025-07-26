# LiteMaaS - LiteLLM User Application

**LiteMaaS** is a comprehensive model subscription and management platform that provides a user-friendly interface for managing AI model subscriptions, API keys, and usage tracking. It's designed to work seamlessly with LiteLLM instances and serves as a bridge between users and AI model services.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development servers (both backend and frontend)
npm run dev

# Backend only (http://localhost:8080)
npm run dev:backend

# Frontend only (http://localhost:3000)
npm run dev:frontend
```

## 📋 Prerequisites

- Node.js 18.x or 20.x
- PostgreSQL 12+
- npm 8+
- LiteLLM instance (optional, has mock fallback)

## 🏗️ Architecture

LiteMaaS is a **monorepo** using npm workspaces with two main packages:

- **Backend** (`@litemaas/backend`): High-performance Fastify API server with PostgreSQL
- **Frontend** (`@litemaas/frontend`): Modern React application with PatternFly 6 UI

### Key Features

- 🔐 **OAuth2 Authentication** with OpenShift integration
- 🤖 **LiteLLM Integration** for AI model management
- 💳 **Subscription Management** with budget tracking
- 🔑 **API Key Generation** for programmatic access
- 📊 **Usage Analytics** and cost tracking
- 👥 **Team Management** with shared budgets
- 🌐 **Internationalization** (EN, ES, FR)
- 📖 **Auto-generated API Documentation** via Swagger

## 🛠️ Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/litemaas.git
   cd litemaas
   ```

2. **Set up environment variables**
   ```bash
   # Copy example environment files
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. **Configure your environment**
   - See [Configuration Guide](docs/deployment/configuration.md) for all available options
   - Minimum required: `DATABASE_URL`, `JWT_SECRET`, OAuth credentials

4. **Start PostgreSQL** (using Docker)
   ```bash
   docker compose -f dev-tools/compose.yaml up -d postgres
   ```

5. **Run the application**
   ```bash
   npm run dev
   ```

## 📚 Documentation

- [Architecture Overview](docs/architecture/overview.md)
- [API Reference](docs/api/README.md)
- [Configuration Guide](docs/deployment/configuration.md)
- [Development Guide](docs/development/setup.md)
- [Production Deployment](docs/deployment/production-guide.md)
- [UI Guidelines (PatternFly 6)](docs/development/ui-guidelines.md)

### Project Planning
- [Project Plan](PROJECT_PLAN.md) - Development roadmap and milestones
- [Implementation Plan](IMPLEMENTATION_PLAN.md) - Detailed implementation phases

## 🧪 Testing

```bash
# Run all tests
npm run test

# Backend tests
npm run test:backend

# Frontend tests
npm run test:frontend

# E2E tests
npm run test:e2e

# Performance tests
npm run test:perf
```

## 🚀 Deployment

For production deployment instructions, see the [Production Guide](docs/deployment/production-guide.md).

### Quick Production Build
```bash
# Build both packages
npm run build

# Build output locations:
# - Backend: backend/dist/
# - Frontend: frontend/dist/
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Code style and conventions
- Development workflow
- Submitting pull requests
- Reporting issues

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [LiteLLM](https://github.com/BerriAI/litellm) - The AI model proxy that LiteMaaS integrates with
- [PatternFly](https://www.patternfly.org/) - The UI framework used in the frontend

## 💬 Support

- 📧 Email: support@litemaas.example.com
- 💬 Discord: [Join our community](https://discord.gg/litemaas)
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/litemaas/issues)

---

Built with ❤️ by the LiteMaaS team