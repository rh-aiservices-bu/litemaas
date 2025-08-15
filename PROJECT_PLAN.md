# LiteMaaS - Project Roadmap

## 🎯 Project Vision

LiteMaaS is an enterprise-ready platform that bridges organizations and AI models through comprehensive subscription management, budget control, and usage analytics.

## Project Overview

Comprehensive model subscription and management platform with deep LiteLLM integration featuring:

- OpenShift OAuth authentication with automatic LiteLLM user creation
- Model discovery and subscription with real-time sync
- Multi-level budget management (user/team/subscription/API key)
- Team collaboration with shared budgets
- API key generation with model access validation
- Real-time usage analytics with cost calculation
- Bidirectional LiteLLM synchronization with conflict resolution
- Automated budget alerts and spend monitoring

## Tech Stack

- **Backend**: Fastify 4.26.1 (Node.js) with TypeScript
- **Frontend**: React 18.2.0 + PatternFly 6
- **Database**: PostgreSQL 12+
- **Authentication**: OpenShift OAuth + JWT
- **API Gateway**: LiteLLM integration
- **Testing**: Vitest, React Testing Library, Playwright, K6

## 📝 References

- **Architecture**: [docs/architecture/](docs/architecture/)
- **API Documentation**: [docs/api/](docs/api/)
- **Deployment Guide**: [docs/deployment/](docs/deployment/)
- **Development Setup**: [docs/development/](docs/development/)

---

_Note: IMPLEMENTATION_PLAN.md has been integrated into this document and can be archived._
