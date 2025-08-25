# LiteMaaS Container Deployment

This document explains how to build and deploy LiteMaaS using containers based on UBI9 (Universal Base Image 9).

## Container Architecture

The LiteMaaS application consists of four main containers:

1. **Backend API** (`backend/Containerfile`) - Multi-stage Node.js/Fastify API server
2. **Frontend Web** (`frontend/Containerfile`) - Multi-stage React SPA served by nginx
3. **PostgreSQL Database** - External database container
4. **LiteLLM Service** - AI model proxy and management UI

## Deployment Options

LiteMaaS containers can be deployed in multiple ways:

- **[OpenShift/Kubernetes](#openshiftkubernetes-deployment)** - Enterprise container orchestration (recommended for production)
- **[Docker/Podman Compose](#dockerpodman-compose-deployment)** - Local development and small deployments
- **[Manual Container Deployment](#manual-container-deployment)** - Individual container management

Both the backend and frontend use optimized three-stage builds that share a common base image with updated packages, providing better caching and efficiency.

## Building Container Images

### Prerequisites

- Podman, Docker, or compatible container engine
- Access to Red Hat UBI9 registry (`registry.access.redhat.com`)
- Node.js (for version extraction from package.json)

### Automated Build Script

LiteMaaS includes an automated build script that handles both backend and frontend container builds with centralized versioning:

> **📦 Custom Registry Configuration**: Before building for production, configure your container registry by editing the `REGISTRY` variable in `scripts/build-containers.sh`:
>
> ```bash
> # Edit this line in scripts/build-containers.sh:
> REGISTRY="quay.io/rh-aiservices-bu"  # Default
>
> # Examples for other registries:
> REGISTRY="ghcr.io/your-org"                    # GitHub Container Registry
> REGISTRY="your-company.com/litemaas"           # Private registry
> REGISTRY="docker.io/your-username"             # Docker Hub
> ```

```bash
# Build both images (uses version from root package.json)
npm run build:containers

# Build and push to configured registry
npm run build:containers:push

# Push existing images only
npm run push:containers
```

**Key Features:**

- 🏷️ **Centralized versioning** - Automatically uses version from root `package.json`
- 🐳 **Runtime detection** - Automatically detects and uses Docker or Podman
- 🏗️ **Flexible options** - Support for different platforms, local builds, and cache control
- ✅ **Validation** - Checks for image existence before push-only operations
- 🔧 **Registry flexibility** - Easy configuration for any container registry

### Manual Build Commands

If you prefer manual control or need to customize the build process:

```bash
# Extract version from root package.json
VERSION=$(node -p "require('./package.json').version")

# Build backend container (launch from the root of the project)
podman build -f backend/Containerfile -t quay.io/rh-aiservices-bu/litemaas-backend:$VERSION .

# Build frontend container (fully environment-agnostic)
podman build -f frontend/Containerfile -t quay.io/rh-aiservices-bu/litemaas-frontend:$VERSION .
```

### Script Options

The build script supports various options for different deployment scenarios:

```bash
# Build without using cache
./scripts/build-containers.sh --no-cache

# Build for specific platform (useful for ARM64)
./scripts/build-containers.sh --platform linux/arm64

# Build with local tags only (no registry prefix)
./scripts/build-containers.sh --local

# Push existing images to registry (validates existence first)
./scripts/build-containers.sh --push

# Build and then push to registry
./scripts/build-containers.sh --build-and-push
```

## Docker/Podman Compose Deployment

The easiest way to run the complete stack locally or for development:

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

| Variable              | Description                  | Default      | Required |
| --------------------- | ---------------------------- | ------------ | -------- |
| `DATABASE_URL`        | PostgreSQL connection string | -            | Yes      |
| `JWT_SECRET`          | JWT signing secret           | -            | Yes      |
| `OAUTH_CLIENT_ID`     | OAuth client ID              | -            | Yes      |
| `OAUTH_CLIENT_SECRET` | OAuth client secret          | -            | Yes      |
| `OAUTH_ISSUER`        | OAuth provider URL           | -            | Yes      |
| `OAUTH_CALLBACK_URL`  | OAuth callback URL           | -            | Yes      |
| `ADMIN_API_KEYS`      | Comma-separated admin keys   | -            | Yes      |
| `LITELLM_API_URL`     | LiteLLM service URL          | -            | Yes      |
| `HOST`                | Server bind address          | `0.0.0.0`    | No       |
| `PORT`                | Server port                  | `8080`       | No       |
| `NODE_ENV`            | Environment mode             | `production` | No       |
| `LOG_LEVEL`           | Logging level                | `info`       | No       |
| `CORS_ORIGIN`         | CORS allowed origins         | -            | No       |

### Frontend Runtime Configuration

The frontend container is now fully environment-agnostic and configured at **runtime**:

| Variable      | Description                                  | Default               | Required |
| ------------- | -------------------------------------------- | --------------------- | -------- |
| `BACKEND_URL` | Backend API URL for proxying `/api` requests | `http://backend:8080` | No       |

**Note**: No build-time configuration is needed. The container image can be built once and deployed to any environment by setting the `BACKEND_URL` environment variable at runtime.

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

# Run frontend (with runtime configuration)
podman run -d --name litemaas-frontend \
  -e BACKEND_URL=https://yourdomain.com \
  -p 3000:8080 \
  litemaas-frontend:latest
```

## OpenShift/Kubernetes Deployment

**🚀 For production deployments, we strongly recommend using OpenShift or Kubernetes.**

LiteMaaS includes comprehensive Kubernetes manifests and Kustomize configuration for enterprise deployments:

### Quick OpenShift Deployment

```bash
# Deploy to OpenShift using Kustomize
oc apply -k deployment/openshift/

# Access applications at:
# - LiteMaaS: https://litemaas-<namespace>.<cluster-domain>
# - LiteLLM UI: https://litellm-<namespace>.<cluster-domain>
```

### Features Included

- ✅ **Production-ready configurations** with health checks and resource limits
- ✅ **Kubernetes Secrets** for secure credential management
- ✅ **OpenShift Routes** with TLS termination
- ✅ **Persistent storage** for PostgreSQL database
- ✅ **Horizontal scaling** support for backend and frontend
- ✅ **OAuth integration** with OpenShift authentication
- ✅ **Kustomize support** for environment-specific configurations

### Complete Setup Guide

For detailed OpenShift deployment instructions including:

- OAuth client configuration
- Secret preparation
- Step-by-step deployment process
- Troubleshooting guide

**📚 See: [OpenShift Deployment Guide](openshift-deployment.md)**

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
2. **Builder stage**: Inherits from base, builds React application without any environment-specific configuration
3. **Runtime stage**: UBI9 nginx with envsubst for runtime configuration, serves the built static files

### Benefits of This Approach:

1. **Smaller final images**: Only production dependencies and built artifacts are included
2. **Enhanced security**: Build tools and dev dependencies are not present in production images
3. **Faster deployments**: Smaller images transfer and start faster
4. **Improved caching**: Shared base image with updated packages reduces redundant work
5. **Efficient builds**: System package updates happen once and are reused
6. **Clean separation**: Build environment is completely separate from runtime environment
7. **Environment-agnostic images**: Frontend container can be deployed to any environment without rebuilding

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
   - Check CORS configuration (`CORS_ORIGIN`) in backend
   - Verify `BACKEND_URL` environment variable is set correctly
   - Ensure backend is healthy and accessible from the frontend container
   - Check nginx logs for proxy errors

3. **OAuth authentication fails:**
   - Verify OAuth client configuration
   - Check redirect URLs match exactly
   - Ensure OAuth provider is accessible
   - See [OAuth Flow in Containerized Environments](#oauth-flow-in-containerized-environments) below

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
- **Production**: Use the deployment instructions
- **Testing**: Both containers support health checks for automated testing

## Image Registry

### Automated Registry Push

For production deployments, the build script can automatically push to the configured registry:

```bash
# Build and push to quay.io/rh-aiservices-bu (default registry)
npm run build:containers:push

# Or manually with the script
./scripts/build-containers.sh --build-and-push
```

The script automatically tags images with:

- Version from root `package.json` (e.g., `quay.io/rh-aiservices-bu/litemaas-backend:1.0.0`)
- Latest tag (e.g., `quay.io/rh-aiservices-bu/litemaas-backend:latest`)

### Manual Registry Operations

If you need manual control over registry operations:

```bash
# Extract version for consistency
VERSION=$(node -p "require('./package.json').version")

# Tag for registry
podman tag litemaas-backend:$VERSION registry.example.com/litemaas/backend:$VERSION
podman tag litemaas-frontend:$VERSION registry.example.com/litemaas/frontend:$VERSION

# Push to registry
podman push registry.example.com/litemaas/backend:$VERSION
podman push registry.example.com/litemaas/frontend:$VERSION
```

### Registry Configuration

> **⚠️ Important**: Always configure your registry BEFORE building and pushing images.

To use a different registry, edit the `REGISTRY` variable in `scripts/build-containers.sh`:

```bash
# Default registry (line ~20 in scripts/build-containers.sh)
REGISTRY="quay.io/rh-aiservices-bu"

# Examples for common registries:
REGISTRY="ghcr.io/your-org"                    # GitHub Container Registry
REGISTRY="your-company.com/your-org"           # Private/corporate registry
REGISTRY="docker.io/your-username"             # Docker Hub
REGISTRY="registry.example.com/your-org"       # Custom registry
```

**Authentication**: Ensure you're logged into your registry before pushing:

```bash
# Docker Hub
docker login

# GitHub Container Registry
docker login ghcr.io -u YOUR_USERNAME

# Custom registry
docker login your-registry.com
```

## OAuth Flow in Containerized Environments

Understanding how OAuth authentication works in containerized deployments is crucial for proper configuration.

### Architecture Overview

In containerized deployments, NGINX serves as the single entry point for all traffic:

```mermaid
graph TB
    subgraph "External"
        Browser[Browser]
        OAuth[OpenShift OAuth Provider]
    end

    subgraph "Container Stack"
        NGINX[NGINX<br/>Port 8080]
        Backend[Backend API<br/>Port 8081]
        Frontend[Frontend SPA<br/>Static Files]
    end

    Browser -->|All requests| NGINX
    NGINX -->|/api/*| Backend
    NGINX -->|/*| Frontend
    Backend <-->|OAuth flow| OAuth
```

### OAuth Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NGINX
    participant Backend
    participant OAuth Provider

    Note over User,OAuth Provider: 1. Login Initiation
    User->>Browser: Click "Login"
    Browser->>NGINX: POST /api/auth/login
    NGINX->>Backend: Proxy request
    Backend->>NGINX: Return OAuth URL
    NGINX->>Browser: Return OAuth URL
    Browser->>OAuth Provider: Redirect to OAuth

    Note over User,OAuth Provider: 2. OAuth Authentication
    User->>OAuth Provider: Enter credentials
    OAuth Provider->>Browser: Redirect to callback

    Note over Browser,Backend: 3. OAuth Callback Processing
    Browser->>NGINX: GET /api/auth/callback?code=xxx
    Note right of Browser: OAuth provider redirects here
    NGINX->>Backend: Proxy to backend
    Backend->>OAuth Provider: Exchange code for token
    OAuth Provider->>Backend: Return access token
    Backend->>Backend: Create/update user

    Note over Backend,Browser: 4. Frontend Redirect
    Backend->>NGINX: 302 Redirect to /auth/callback
    Note right of Backend: Relative redirect works<br/>in any environment
    NGINX->>Browser: 302 Redirect
    Browser->>NGINX: GET /auth/callback
    NGINX->>NGINX: Serve frontend SPA
    Note over Browser: Frontend extracts token<br/>from URL hash
```

### Key Configuration Points

#### 1. OAuth Callback URL (With Automatic Detection)

As of the latest update, LiteMaaS implements **automatic OAuth callback URL detection** based on request origin. This eliminates many common configuration issues:

##### How It Works

1. **During Login**: The backend detects the request origin and stores the appropriate callback URL with the OAuth state
2. **During Callback**: The stored callback URL is retrieved and used for token exchange (ensuring OAuth compliance)
3. **Fallback**: The `OAUTH_CALLBACK_URL` environment variable serves as a fallback when automatic detection isn't possible

##### Register Multiple Callback URLs

Register ALL possible callback URLs with your OAuth provider:

| Environment          | Callback URLs to Register                                                              | Notes                         |
| -------------------- | -------------------------------------------------------------------------------------- | ----------------------------- |
| Development (Vite)   | `http://localhost:3000/api/auth/callback`                                              | Vite dev server on port 3000  |
| Development (Direct) | `http://localhost:8081/api/auth/callback`<br>`http://localhost:8081/api/auth/callback` | Direct backend access         |
| Container (NGINX)    | `http://localhost:8081/api/auth/callback`                                              | NGINX on port 8080            |
| Production           | `https://your-domain.com/api/auth/callback`                                            | Through ingress/load balancer |

##### Example OAuth Provider Configuration

```yaml
# OpenShift OAuthClient
apiVersion: oauth.openshift.io/v1
kind: OAuthClient
metadata:
  name: litemaas
secret: your-secret-here
redirectURIs:
  - http://localhost:3000/api/auth/callback # Vite development
  - http://localhost:8081/api/auth/callback # Container/Direct
  - http://localhost:8081/api/auth/callback # Backend direct
  - https://your-domain.com/api/auth/callback # Production
grantMethod: prompt
```

The application will automatically select the correct callback URL based on where the request originates.

#### 2. NGINX Proxy Configuration

The critical NGINX configuration that makes this work:

```nginx
# From nginx.conf.template
location /api {
    proxy_pass http://api_servers;  # Backend container
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# All other paths serve the frontend SPA
location / {
    try_files $uri $uri/ /index.html;
}
```

#### 3. Backend Relative Redirects

The backend uses relative redirects to ensure environment portability:

```typescript
// After OAuth callback processing
const callbackPath = `/auth/callback#token=${token}&expires_in=${expiresIn}`;
return reply.redirect(callbackPath); // Relative redirect
```

This means:

- No `FRONTEND_URL` configuration needed
- Works regardless of domain or port
- Browser maintains the current origin

### Common OAuth Issues and Solutions

#### Issue: "invalid_request" during token exchange

**Symptom**: OAuth callback fails with 400 error: "The request is missing a required parameter"

**Cause**: The `redirect_uri` parameter doesn't match between authorization and token exchange

**Solution**:

1. Register all possible callback URLs with your OAuth provider
2. The automatic detection ensures the same URL is used in both phases
3. Check backend logs for "Token exchange callback URL" to see what's being used

#### Issue: "Host can't be reached" after OAuth callback

**Symptom**: After login, browser tries to reach wrong port (e.g., `http://localhost:3000/auth/callback`)

**Cause**: Mismatch between where frontend is served and OAuth callback configuration

**Solution**:

1. The backend now uses relative redirects (`/auth/callback`)
2. Automatic callback URL detection handles port differences
3. Ensure all possible URLs are registered with OAuth provider

#### Issue: Different environments need different callback URLs

**Symptom**: OAuth works in development but not in containers, or vice versa

**Cause**: Hard-coded callback URLs don't match the deployment environment

**Solution**:

1. Register multiple callback URLs with your OAuth provider
2. Automatic detection selects the right one based on request origin
3. No need to change configuration between environments

#### Issue: OAuth callback fails with 404

**Symptom**: OAuth provider redirects to callback URL but gets 404

**Cause**: Wrong OAuth callback URL configuration or NGINX proxy issue

**Solution**:

1. Verify OAuth callback URL includes `/api/auth/callback`
2. Ensure NGINX is properly proxying `/api/*` to backend
3. Check backend is running and healthy

#### Issue: CORS errors during OAuth flow

**Symptom**: Browser console shows CORS errors

**Cause**: Backend CORS configuration doesn't match frontend origin

**Solution**: Set `CORS_ORIGIN` environment variable to match your frontend URL

### Testing OAuth Flow

To test OAuth in containerized environment:

1. **Start containers with proper configuration:**

```bash
# Backend with OAuth config
podman run -d --name backend \
  -e OAUTH_CLIENT_ID=your-client \
  -e OAUTH_CLIENT_SECRET=your-secret \
  -e OAUTH_ISSUER=https://oauth.provider \
  -e OAUTH_CALLBACK_URL=http://localhost:8081/api/auth/callback \
  -e CORS_ORIGIN=http://localhost:8081 \
  -e LOG_LEVEL=debug \
  -p 8081:8080 \
  litemaas-backend

# Note: Set LOG_LEVEL=debug to see OAuth callback URL detection in action

# Frontend with NGINX
podman run -d --name frontend \
  -e BACKEND_URL=http://host.docker.internal:8081 \
  -p 8080:8080 \
  litemaas-frontend
```

2. **Verify OAuth flow:**
   - Navigate to `http://localhost:8081`
   - Click login
   - Should redirect to OAuth provider
   - After login, should return to `http://localhost:8081/home`

### Security Considerations

1. **Always use HTTPS in production** for OAuth flows
2. **Validate OAuth state parameter** to prevent CSRF attacks
3. **Use secure token storage** in frontend (httpOnly cookies or secure localStorage)
4. **Implement proper CORS policies** to prevent unauthorized access
5. **Regular token rotation** and expiration handling
