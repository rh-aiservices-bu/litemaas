# LiteMaaS - LiteLLM Model as a Service

A user-friendly application for interacting with LiteLLM, providing model discovery, subscription management, and usage analytics.

## Features

- 🔐 **OpenShift OAuth Authentication** - Secure authentication using OpenShift OAuth provider
- 🔍 **Model Discovery** - Browse and search available models through LiteLLM
- 🔑 **API Key Management** - Generate and manage API keys for model access
- 📊 **Usage Statistics** - Track and visualize model consumption
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

## License

[License information to be added]