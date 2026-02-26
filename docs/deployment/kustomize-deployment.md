# Kustomize Deployment Guide (OpenShift)

This guide covers the **Kustomize-based** deployment method for OpenShift Container Platform. It's designed for users with varying levels of OpenShift experience.

> **Alternative**: For a Helm-based deployment that works on both Kubernetes and OpenShift, see the [Helm Chart Deployment Guide](helm-deployment.md).

> **📁 Source of Truth**: All deployment files and templates are in [`deployment/kustomize/`](../../deployment/kustomize/). This document is a deployment guide that references those authoritative files.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [OAuth Client Configuration](#oauth-client-configuration)
- [User Role Management and OpenShift Groups](#user-role-management-and-openshift-groups)
- [Deployment Process](#deployment-process)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Accessing the Applications](#accessing-the-applications)
- [Troubleshooting](#troubleshooting)
- [Maintenance Operations](#maintenance-operations)

## Prerequisites

### Required Access and Tools

1. **OpenShift Cluster Access**
   - Access to an OpenShift 4.x cluster
   - Cluster admin privileges OR project admin privileges
   - Ability to create projects/namespaces

2. **Command Line Tools**

   ```bash
   # Install OpenShift CLI (choose your platform)
   # For Linux:
   curl -L https://mirror.openshift.com/pub/openshift-v4/clients/ocp/stable/openshift-client-linux.tar.gz | tar xz
   sudo mv oc /usr/local/bin/

   # For macOS:
   brew install openshift-cli

   # For Windows: Download from https://mirror.openshift.com/pub/openshift-v4/clients/ocp/stable/
   ```

3. **Verify CLI Installation**

   ```bash
   oc version
   # Should show both client and server versions
   ```

### Required Information

Before starting, gather the following information:

- OpenShift cluster API endpoint
- Your OpenShift login credentials
- Desired namespace/project name (default: `litemaas`)
- Cluster's default domain, afterwards identified as `<your-cluster-domain>`. E.g.: `apps.your-cluster.example.com`

## Architecture Overview

The LiteMaaS deployment consists of four main components:

1. **PostgreSQL Database** - Persistent data storage (StatefulSet)
2. **LiteMaaS Backend** - Fastify API server
3. **LiteMaaS Frontend** - React web application
4. **LiteLLM Service** - AI model proxy and management UI

### Network Architecture

```text
Internet → OpenShift Router → Routes → Services → Pods
                           ↓
                    Frontend Route (litemaas-<namespace>.<cluster-domain>)
                    LiteLLM Route (litellm-<namespace>.<cluster-domain>)
```

### Data Flow

```text
User → Frontend → Backend → PostgreSQL
                     ↓
              LiteLLM Service → External AI APIs
```

## OAuth Client Configuration

LiteMaaS uses OpenShift's built-in OAuth for authentication. Follow these steps to set up the OAuth client.

### Step 1: Access OpenShift Web Console

1. Open your browser and navigate to the OpenShift web console
2. Log in with cluster admin credentials
3. Switch to **Administrator** perspective (top-left dropdown)

### Step 2: Navigate to OAuth Configuration

1. In the left sidebar, go to **Administration** → **Cluster Settings**
2. Click on the **Configuration** tab
3. Find and click on **OAuth**

### Step 3: Create OAuth Client

1. Click on the **OAuth clients** tab
2. Click **Create OAuth client**
3. Fill in the OAuth client form:

   ```yaml
   kind: OAuthClient
   apiVersion: oauth.openshift.io/v1
   metadata:
     name: litemaas-oauth-client
   secret: <your_secret>
   redirectURIs:
     - 'https://litemaas-<your-namespace>.<your-cluster-domain>/api/auth/callback'
   grantMethod: auto
   ```

4. Click **Create**

**Alternatively** save the above as a file `litemass-oauth.yaml` and apply with `oc apply -f litemass-oauth.yaml`

### Step 4: Retrieve OAuth Information

After creating the OAuth client, you'll need:

1. **OAuth Client ID**: The name you entered (e.g., `litemaas-oauth-client`)

2. **OAuth Client Secret**:
   - Click on your newly created OAuth client
   - Copy the **Secret** value shown

3. **OAuth Issuer URL**:

   ```bash
   # Get the OAuth issuer URL
   oc get route oauth-openshift -n openshift-authentication -o jsonpath='{.spec.host}'
   # Add https:// prefix to the result
   # Example: https://oauth-openshift.apps.cluster.example.com
   ```

4. **OAuth Callback URL**: The redirect URI you configured above

### Step 5: Verify OAuth Configuration

```bash
# Test OAuth endpoint accessibility
curl -k https://oauth-openshift.apps.cluster.example.com/.well-known/oauth_authorization_server
# Should return JSON with OAuth server configuration
```

## User Role Management and OpenShift Groups

LiteMaaS implements role-based access control (RBAC) by mapping OpenShift groups to application roles. **Configuring these groups is essential for proper access control** - without them, all users will have limited access regardless of their intended permissions.

### Overview of OpenShift Groups

LiteMaaS recognizes three OpenShift groups that map to specific application roles:

| OpenShift Group | LiteMaaS Role | Capabilities |
|----------------|---------------|--------------|
| `litemaas-admins` | `admin` | Full system access: manage users, subscriptions, models, API keys, system configuration |
| `litemaas-readonly` | `adminReadonly` | Read-only administrative access: view all data and statistics, no modification permissions |
| `litemaas-users` | `user` | Standard user access: manage own subscriptions and API keys (default role for all authenticated users) |

**Important Notes**:
- Users can be members of multiple groups - the role with the highest permissions will be applied
- All authenticated users automatically receive the `user` role, even without group membership
- The `litemaas-users` group is optional - it's only needed if you want explicit group-based user management
- Group membership is evaluated during OAuth login - changes take effect on next user login

### Creating OpenShift Groups

As a cluster administrator, create the required groups before deploying LiteMaaS:

```bash
# Create administrative groups (required)
oc adm groups new litemaas-admins
oc adm groups new litemaas-readonly

# Create users group (optional - for explicit group management)
oc adm groups new litemaas-users
```

### Adding Users to Groups

Add users to groups based on their required access level:

```bash
# Add administrators (full access)
oc adm groups add-users litemaas-admins admin@company.com other-admin@company.com

# Add read-only administrators
oc adm groups add-users litemaas-readonly readonly-admin@company.com viewer@company.com

# Add standard users (optional)
oc adm groups add-users litemaas-users user1@company.com user2@company.com
```

### Verifying Group Configuration

```bash
# List all groups
oc get groups

# View members of a specific group
oc get group litemaas-admins -o yaml

# Check which groups a user belongs to
oc get groups -o json | jq -r '.items[] | select(.users[]? | contains("admin@company.com")) | .metadata.name'
```

### Group Management Best Practices

1. **Principle of Least Privilege**: Only assign admin roles to users who require full system access
2. **Use Read-Only Admin**: For users who need visibility without modification capabilities (e.g., auditors, managers)
3. **Regular Audits**: Periodically review group membership to ensure appropriate access levels
4. **Document Assignments**: Maintain records of why users have specific access levels

### Role Mapping Technical Details

The group-to-role mapping is defined in the LiteMaaS backend and automatically applied during OAuth authentication. When a user logs in:

1. OpenShift OAuth returns the user's group memberships
2. LiteMaaS maps groups to roles using this configuration:
   ```javascript
   {
     'litemaas-admins': ['admin', 'user'],
     'litemaas-readonly': ['adminReadonly', 'user'],
     'litemaas-users': ['user']
   }
   ```
3. The most privileged role is assigned to the user's session
4. Role-based permissions are enforced on all API endpoints

### Troubleshooting Group-Based Access

**Issue**: User doesn't have expected permissions after group assignment

**Solutions**:
- Verify group membership: `oc get group <group-name> -o yaml`
- Have the user log out and log back in to refresh their session
- Check backend logs for role assignment: `oc logs deployment/backend | grep -i "role"`
- Verify OAuth token includes group claims

**Issue**: All users have admin access or no users have admin access

**Solutions**:
- Verify groups were created before deployment
- Check that group names exactly match: `litemaas-admins`, `litemaas-readonly`, `litemaas-users`
- Review backend configuration for any role mapping overrides

For comprehensive RBAC documentation, including API endpoint permissions and testing procedures, see:
- [`docs/deployment/authentication.md`](./authentication.md) - Complete authentication and RBAC setup
- [`docs/features/user-roles-administration.md`](../features/user-roles-administration.md) - Detailed role capabilities and use cases

## Deployment Process

### Step 1: Prepare Repository and Login

```bash
# Clone the repository if you haven't already
git clone https://github.com/rh-aiservices-bu/litemaas.git
cd litemaas

# Login to OpenShift
oc login --token=<your-token> --server=https://api.cluster.example.com:6443
# OR
oc login -u <username> -p <password> https://api.cluster.example.com:6443

# Create or use a project
oc new-project litemaas --display-name="LiteMaaS Application"
# OR
oc project your-existing-project

# Get the cluster domain for configuration
oc get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}'
# Example output: apps.cluster.example.com
```

### Step 2: Configure Deployment

The deployment uses a template-based configuration system. All secrets and environment-specific values are managed through templates:

```bash
# Navigate to the OpenShift deployment directory
cd deployment/kustomize

# Copy the example configuration
cp user-values.env.example user-values.env

# Edit the configuration file with your actual values
vi user-values.env
```

**Edit `user-values.env`** with your specific values:

```bash
LITEMAAS_VERSION=0.0.18
CLUSTER_DOMAIN_NAME=apps.your-cluster.example.com
NAMESPACE=litemaas
PG_ADMIN_PASSWORD=your-secure-db-password
JWT_SECRET=your-secure-jwt-secret-64-chars
OAUTH_CLIENT_ID=litemaas-oauth-client
OAUTH_CLIENT_SECRET=your-oauth-client-secret-from-step-4
ADMIN_API_KEY=ltm_admin_your-admin-key
LITELLM_API_KEY=sk-your-litellm-master-key
LITELLM_MASTER_KEY=  # Optional: encryption key for stored model API keys (defaults to LITELLM_API_KEY)
LITELLM_UI_USERNAME=admin
LITELLM_UI_PASSWORD=your-litellm-ui-password
```

> **💡 Security Tips**:
>
> ```bash
> # Generate secure passwords:
> openssl rand -base64 32   # For passwords
> openssl rand -base64 64   # For JWT secret
> openssl rand -hex 16      # For API keys
> ```

### Step 3: Build and Push Container Images (Optional)

If you need to build custom images or use a different registry:

> **📦 Registry Configuration**: If using a custom registry, edit the `REGISTRY` variable in `scripts/build-containers.sh` FIRST:
>
> ```bash
> # Edit line ~20 in scripts/build-containers.sh:
> REGISTRY="quay.io/rh-aiservices-bu"  # Default
>
> # Change to your registry:
> REGISTRY="your-registry.com/your-org"
> REGISTRY="ghcr.io/your-org"         # GitHub Container Registry
> REGISTRY="docker.io/your-username"  # Docker Hub
> ```

```bash
# 1. Configure registry (if needed) - edit scripts/build-containers.sh
# 2. Login to your registry
docker login your-registry.com

# 3. Build container images with current version
npm run build:containers

# 4. Build and push to your configured registry
npm run build:containers:push
```

**Default Images**: The deployment templates use pre-built images from `quay.io/rh-aiservices-bu`. You only need this step if:

- Building from source code
- Using a custom or private registry
- Building with custom modifications
- Your organization requires specific registry usage

### Step 4: Generate Deployment Files

The deployment uses environment variable substitution to generate actual deployment files from templates:

```bash
# Generate the .local files from templates
./preparation.sh

# This creates *.local files that contain your actual configuration
# Example: backend-secret.yaml.template → backend-secret.yaml.local
```

### Step 5: Deploy to OpenShift

```bash
# Preview what will be deployed
oc apply -k . --dry-run=client

# Deploy all resources using Kustomize
oc apply -k .

# Monitor deployment progress
oc get pods -w
```

### Step 5: Wait for Deployment Completion

```bash
# Wait for PostgreSQL to be ready (this may take 2-3 minutes)
oc wait --for=condition=ready pod -l app=postgres --timeout=300s

# Wait for backend to be ready
oc wait --for=condition=ready pod -l app=backend --timeout=300s

# Wait for frontend to be ready
oc wait --for=condition=ready pod -l app=frontend --timeout=300s

# Wait for LiteLLM to be ready
oc wait --for=condition=ready pod -l app=litellm --timeout=300s

# Verify all pods are running
oc get pods
# All pods should show STATUS as "Running" and READY as "1/1"
```

## Post-Deployment Configuration

### Step 1: Verify Database Initialization

(optional, if this does not work the rest won't have deployed...)

```bash
# Check PostgreSQL logs
oc logs -l app=postgres --tail=50

# Test database connectivity from backend
oc exec deployment/backend -- curl -f http://localhost:8080/api/v1/health/ready
```

### Step 2: Access LiteLLM Administration UI

(optional, LiteLLM access not needed anymore)

1. Get the LiteLLM route URL:

   ```bash
   oc get route litellm -o jsonpath='{.spec.host}'
   # Example: litellm-litemaas.apps.cluster.example.com
   ```

2. Open the LiteLLM UI in your browser:

   ```text
   https://litellm-litemaas.apps.cluster.example.com
   ```

3. Login with the credentials from your `user-values.env`:
   - **Username**: admin (or value of `LITELLM_UI_USERNAME`)
   - **Password**: (value of `LITELLM_UI_PASSWORD`)

### Step 3: Verify LiteMaaS Application

1. Get the frontend route URL:

   ```bash
   oc get route litemaas -o jsonpath='{.spec.host}'
   # Example: litemaas-litemaas.apps.cluster.example.com
   ```

2. Open LiteMaaS in your browser:

   ```text
   https://litemaas-litemaas.apps.cluster.example.com
   ```

3. Test OAuth login by clicking the login button

## Accessing the Applications

After successful deployment, you can access:

### LiteMaaS Main Application

- **URL**: `https://litemaas-<namespace>.<cluster-domain>`
- **Purpose**: Main user interface for model subscriptions and API key management
- **Authentication**: OpenShift OAuth

### LiteLLM Administration UI

- **URL**: `https://litellm-<namespace>.<cluster-domain>`
- **Purpose**: Model configuration and monitoring
- **Authentication**: Username/password (admin UI)

### API Endpoints

The backend API is accessible internally at:

- **Service URL**: `http://backend:8080`
- **Health Check**: `http://backend:8080/api/v1/health`
- **Swagger Docs**: `http://backend:8080/docs`

## Troubleshooting

### Common Issues and Solutions

#### 1. Pods Not Starting

**Symptoms**: Pods stuck in `Pending`, `CrashLoopBackOff`, or `ImagePullBackOff` state

**Diagnosis**:

```bash
# Check pod status and events
oc describe pod <pod-name>

# Check pod logs
oc logs <pod-name>
```

**Solutions**:

- **ImagePullBackOff**: Verify image names and tags in deployment files
- **Pending**: Check resource requests and cluster capacity
- **CrashLoopBackOff**: Check application logs and environment variables

#### 2. Database Connection Issues

**Symptoms**: Backend pods failing with database connection errors

**Diagnosis**:

```bash
# Check PostgreSQL pod status
oc get pods -l app=postgres

# Check PostgreSQL logs
oc logs -l app=postgres --tail=50

# Test database connectivity
oc exec statefulset/postgres -- pg_isready -U litemaas_admin -d litemaas_db
```

**Solutions**:

- Verify `postgres-secret.yaml.local` has correct credentials
- Check if PostgreSQL service is accessible: `oc get svc postgres`
- Ensure PostgreSQL is fully initialized before backend starts

#### 3. OAuth Authentication Problems

**Symptoms**: Login redirects fail or authentication loops

**Diagnosis**:

```bash
# Check backend logs for OAuth errors
oc logs deployment/backend --tail=100 | grep -i oauth

# Verify OAuth client configuration
oc get oauthclients litemaas-oauth-client -o yaml
```

**Solutions**:

- Verify OAuth redirect URLs match your route URLs exactly
- Check OAuth client secret is correctly set in `backend-secret.yaml.local`
- Ensure OAuth issuer URL is accessible from within the cluster

#### 4. Template Configuration Errors

**Symptoms**: Pods failing to start after deployment, missing environment variables

**Diagnosis**:

```bash
# Check if .local files were generated
ls -la *.local

# Verify secret content
oc get secret backend-secret -o jsonpath='{.data}' | jq keys
```

**Solutions**:

- Ensure `user-values.env` has all required values
- Re-run `./preparation.sh` to regenerate .local files
- Verify all template variables are properly substituted

#### 5. Route Accessibility Issues

**Symptoms**: Routes return 503 errors or timeouts

**Diagnosis**:

```bash
# Check route status
oc get routes

# Check service endpoints
oc get endpoints

# Test service connectivity
oc exec deployment/backend -- curl -f http://frontend:8080/
```

**Solutions**:

- Verify services are properly selecting pods: `oc describe svc <service-name>`
- Check if pods are ready and healthy
- Verify route TLS configuration

### Advanced Debugging

#### Enable Debug Logging

```bash
# Enable debug logging for backend
oc set env deployment/backend LOG_LEVEL=debug

# Check debug logs
oc logs deployment/backend -f
```

#### Resource Issues

```bash
# Check resource usage
oc top pods
oc describe nodes

# Adjust resource limits if needed
oc edit deployment backend
```

#### Network Connectivity Tests

```bash
# Test internal service connectivity
oc run debug --image=curlimages/curl --rm -it --restart=Never -- curl http://backend:8080/api/v1/health

# Test external connectivity
oc run debug --image=curlimages/curl --rm -it --restart=Never -- curl https://oauth-openshift.apps.cluster.example.com/.well-known/oauth_authorization_server
```

## Maintenance Operations

### Updating Application Images

```bash
# Update to a new image version using Kustomize
# Edit kustomization.yaml to change image tags, then:
oc apply -k .

# Or update directly
oc set image deployment/backend backend=quay.io/rh-aiservices-bu/litemaas-backend:v1.1.0
oc set image deployment/frontend frontend=quay.io/rh-aiservices-bu/litemaas-frontend:v1.1.0

# Monitor rollout
oc rollout status deployment/backend
oc rollout status deployment/frontend
```

### Scaling Components

```bash
# Scale backend for higher load
oc scale deployment backend --replicas=3

# Scale frontend
oc scale deployment frontend --replicas=3

# PostgreSQL should remain at 1 replica (StatefulSet)
```

### Backup and Restore

#### Database Backup

```bash
# Create database backup
oc exec -i statefulset/postgres -- pg_dump -U litemaas_admin litemaas_db > litemaas-backup-$(date +%Y%m%d).sql

# Store backup securely (example with persistent volume)
oc create pvc backup-pvc --size=10Gi
oc run backup-job --image=postgres:16-alpine --rm -it --restart=Never \
  --mount-path=/backup --volume-claim-name=backup-pvc \
  -- bash -c "pg_dump -h postgres -U litemaas_admin litemaas_db > /backup/litemaas-$(date +%Y%m%d).sql"
```

#### Database Restore

```bash
# Restore from backup (CAUTION: This will overwrite existing data)
oc exec -i statefulset/postgres -- psql -U litemaas_admin litemaas_db < litemaas-backup-20241201.sql
```

### Configuration Updates

To update configuration values:

```bash
# Edit your configuration
vi user-values.env

# Regenerate deployment files
./preparation.sh

# Apply updates
oc apply -k .

# Restart affected deployments if needed
oc rollout restart deployment/backend
oc rollout restart deployment/frontend
```

### Monitoring and Alerts

```bash
# Check application health
oc get pods --field-selector=status.phase!=Running

# Monitor resource usage
oc top pods

# Check recent events
oc get events --sort-by='.lastTimestamp'
```

### Log Management

```bash
# View aggregated logs
oc logs -l app=backend --since=1h
oc logs -l app=frontend --since=1h
oc logs -l app=litellm --since=1h

# Follow logs in real-time
oc logs -f deployment/backend
```

## Security Best Practices

1. **Secret Management**
   - Rotate secrets regularly
   - Use strong, randomly generated passwords
   - Never commit `user-values.env` or `*.local` files to version control

2. **Network Security**
   - Use TLS for all external routes
   - Implement network policies if required
   - Restrict service account permissions

3. **Container Security**
   - Keep container images updated
   - Use non-root containers (already configured)
   - Implement security scanning in CI/CD

4. **Access Control**
   - Follow principle of least privilege
   - Regularly audit user access
   - Use OpenShift RBAC effectively

## Support and Community

For additional support:

- **Source Files**: [`deployment/kustomize/`](../../deployment/kustomize/) - Authoritative deployment configuration
- **Documentation**: Check the `docs/` directory for detailed guides
- **Configuration Reference**: [`docs/deployment/configuration.md`](./configuration.md) - Environment variables
- **Issues**: Report problems via GitHub Issues
- **Community**: Join our Discord community for discussions

---

**Note**: This guide assumes a standard OpenShift 4.x installation. Some steps may vary depending on your cluster configuration and available features.
