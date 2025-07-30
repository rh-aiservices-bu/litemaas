# LiteMaaS Container Deployment

This document explains how to build and deploy LiteMaaS using containers based on UBI9 (Universal Base Image 9).

## Container Architecture

The LiteMaaS application consists of three main containers:

1. **Backend API** (`backend/Containerfile`) - Multi-stage Node.js/Fastify API server
2. **Frontend Web** (`frontend/Containerfile`) - Multi-stage React SPA served by nginx
3. **PostgreSQL Database** - External database container

Both the backend and frontend use optimized three-stage builds that share a common base image with updated packages, providing better caching and efficiency.

## Building Container Images

### Prerequisites

- Podman, Docker, or compatible container engine
- Access to Red Hat UBI9 registry (`registry.access.redhat.com`)

### Build Commands

```bash
# Build backend container
podman build -t litemaas-backend:latest -f backend/Containerfile backend/

# Build frontend container with custom configuration
podman build -t litemaas-frontend:latest \
  --build-arg VITE_API_URL=https://api.yourdomain.com \
  --build-arg VITE_OAUTH_CLIENT_ID=your-oauth-client \
  --build-arg VITE_OAUTH_REDIRECT_URL=https://yourdomain.com/auth/callback \
  -f frontend/Containerfile frontend/
```

### Using Docker/Podman Compose

The easiest way to run the complete stack:

```bash
# Start all services
podman-compose up -d

# Or with Docker Compose
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Backend API on port 8080
- Frontend web app on port 3000
- LiteLLM service on port 4000

## Container Configuration

### Backend Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `OAUTH_CLIENT_ID` | OAuth client ID | - | Yes |
| `OAUTH_CLIENT_SECRET` | OAuth client secret | - | Yes |
| `OAUTH_ISSUER` | OAuth provider URL | - | Yes |
| `OAUTH_CALLBACK_URL` | OAuth callback URL | - | Yes |
| `ADMIN_API_KEYS` | Comma-separated admin keys | - | Yes |
| `LITELLM_API_URL` | LiteLLM service URL | - | Yes |
| `HOST` | Server bind address | `0.0.0.0` | No |
| `PORT` | Server port | `8080` | No |
| `NODE_ENV` | Environment mode | `production` | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `CORS_ORIGIN` | CORS allowed origins | - | No |

### Frontend Build Arguments

These are set at **build time** for the frontend container:

| Argument | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8080` |
| `VITE_OAUTH_CLIENT_ID` | OAuth client ID | `litemaas-client` |
| `VITE_OAUTH_REDIRECT_URL` | OAuth redirect URL | `http://localhost:8080/auth/callback` |
| `VITE_APP_NAME` | Application name | `LiteMaaS` |
| `VITE_APP_VERSION` | Application version | `1.0.0` |

## Production Deployment

### Manual Container Deployment

1. **Create a custom environment file:**

```bash
# production.env
DATABASE_URL=postgresql://user:password@db-host:5432/litemaas
JWT_SECRET=your-strong-jwt-secret-here
OAUTH_CLIENT_ID=your-oauth-client-id
OAUTH_CLIENT_SECRET=your-oauth-client-secret
OAUTH_ISSUER=https://your-oauth-provider
OAUTH_CALLBACK_URL=https://yourdomain.com/api/auth/callback
ADMIN_API_KEYS=your-admin-api-key
LITELLM_API_URL=https://your-litellm-instance
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

2. **Run the containers:**

```bash
# Run database
podman run -d --name litemaas-postgres \
  -e POSTGRES_DB=litemaas \
  -e POSTGRES_USER=litemaas_user \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 \
  postgres:16-alpine

# Run backend
podman run -d --name litemaas-backend \
  --env-file production.env \
  -p 8080:8080 \
  litemaas-backend:latest

# Run frontend
podman run -d --name litemaas-frontend \
  -p 3000:8080 \
  litemaas-frontend:latest
```

### Kubernetes/OpenShift Deployment

The containers are designed to work well in Kubernetes environments:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: litemaas-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: litemaas-backend
  template:
    metadata:
      labels:
        app: litemaas-backend
    spec:
      containers:
      - name: backend
        image: litemaas-backend:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: litemaas-secrets
              key: database-url
        # ... other environment variables
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Health Checks

Both containers include built-in health checks:

- **Backend**: `GET /api/v1/health`
- **Frontend**: `GET /` (nginx status)

## Optimized Multi-Stage Build Architecture

Both containers use an optimized three-stage build approach:

### Backend Build Stages:
1. **Base stage**: UBI9 Node.js with updated system packages
2. **Builder stage**: Inherits from base, installs dev dependencies, builds application
3. **Runtime stage**: Inherits from base, installs only production dependencies, copies built artifacts

### Frontend Build Stages:
1. **Base stage**: UBI9 Node.js with updated system packages (for building)
2. **Builder stage**: Inherits from base, builds React application
3. **Runtime stage**: UBI9 nginx serves the built static files

### Benefits of This Approach:

1. **Smaller final images**: Only production dependencies and built artifacts are included
2. **Enhanced security**: Build tools and dev dependencies are not present in production images
3. **Faster deployments**: Smaller images transfer and start faster
4. **Improved caching**: Shared base image with updated packages reduces redundant work
5. **Efficient builds**: System package updates happen once and are reused
6. **Clean separation**: Build environment is completely separate from runtime environment

## Security Considerations

1. **Non-root execution**: Containers run as non-root users (UID 1001)
2. **Minimal attack surface**: Based on UBI9 minimal images, with multi-stage builds removing build tools
3. **Security headers**: Frontend nginx includes security headers
4. **Environment separation**: Use different secrets for different environments
5. **Clean production images**: No build tools or dev dependencies in final images

## Troubleshooting

### Common Issues

1. **Backend fails to connect to database:**
   - Check `DATABASE_URL` format
   - Ensure database is accessible from container network
   - Verify database credentials

2. **Frontend can't reach backend API:**
   - Check CORS configuration (`CORS_ORIGIN`)
   - Verify API URL in frontend build args
   - Ensure backend is healthy

3. **OAuth authentication fails:**
   - Verify OAuth client configuration
   - Check redirect URLs match exactly
   - Ensure OAuth provider is accessible

### Viewing Logs

```bash
# Backend logs
podman logs litemaas-backend

# Frontend logs (nginx)
podman logs litemaas-frontend

# Database logs
podman logs litemaas-postgres
```

### Development vs Production

- **Development**: Use the existing `dev-tools/compose.yaml` for local development
- **Production**: Use the root `compose.yaml` or deploy containers individually
- **Testing**: Both containers support health checks for automated testing

## Image Registry

For production deployments, push images to a container registry:

```bash
# Tag for registry
podman tag litemaas-backend:latest registry.example.com/litemaas/backend:v1.0.0
podman tag litemaas-frontend:latest registry.example.com/litemaas/frontend:v1.0.0

# Push to registry
podman push registry.example.com/litemaas/backend:v1.0.0
podman push registry.example.com/litemaas/frontend:v1.0.0
``` 