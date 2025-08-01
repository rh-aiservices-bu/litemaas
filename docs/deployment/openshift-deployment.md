# OpenShift Deployment Guide for LiteMaaS

This guide provides step-by-step instructions for deploying LiteMaaS on OpenShift Container Platform. It's designed for users with varying levels of OpenShift experience.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Pre-Deployment Setup](#pre-deployment-setup)
- [OAuth Client Configuration](#oauth-client-configuration)
- [Secret Configuration](#secret-configuration)
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
- Cluster's default domain (e.g., `apps.cluster.example.com`)

## Architecture Overview

The LiteMaaS deployment consists of four main components:

1. **PostgreSQL Database** - Persistent data storage
2. **LiteMaaS Backend** - Fastify API server
3. **LiteMaaS Frontend** - React web application
4. **LiteLLM Service** - AI model proxy and management UI

### Network Architecture

```
Internet → OpenShift Router → Routes → Services → Pods
                           ↓
                    Frontend Route (litemaas-<namespace>.apps.<cluster>)
                    LiteLLM Route (litellm-<namespace>.apps.<cluster>)
```

### Data Flow

```
User → Frontend → Backend → PostgreSQL
                     ↓
              LiteLLM Service → External AI APIs
```

## Pre-Deployment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/litemaas.git
cd litemaas
```

### 2. Login to OpenShift

```bash
# Option 1: Using web console token
oc login --token=<your-token> --server=https://api.cluster.example.com:6443

# Option 2: Using username/password
oc login -u <username> -p <password> https://api.cluster.example.com:6443

# Verify login
oc whoami
oc cluster-info
```

### 3. Create Project/Namespace

```bash
# Create a new project
oc new-project litemaas --display-name="LiteMaaS Application" --description="LiteMaaS AI Model Management Platform"

# OR use an existing project
oc project your-existing-project
```

### 4. Get Cluster Domain Information

```bash
# Get the cluster's app domain
oc get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}'
# Example output: apps.cluster.example.com
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
   - 'https://litemaas-<your-namespace>.apps.<your-cluster-domain>/api/auth/callback'
   grantMethod: auto
   ```

4. Click **Create**

### Step 4: Retrieve OAuth Information

After creating the OAuth client, you'll need several pieces of information:

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

## Secret Configuration

The application requires several secrets to be configured before deployment. We'll create these secrets with the OAuth information gathered above.

### Understanding the Secrets

1. **postgres-secret**: Database credentials
2. **backend-secret**: Backend API configuration
3. **litellm-secret**: LiteLLM service configuration

### Step 1: Generate Secure Values

```bash
# Generate secure passwords and keys
export POSTGRES_PASSWORD=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 64)
export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 16)"
export LITELLM_UI_PASSWORD=$(openssl rand -base64 16)
export ADMIN_API_KEY="ltm_admin_$(openssl rand -hex 12)"

# Show generated values (save these securely!)
echo "Generated secure values:"
echo "POSTGRES_PASSWORD: $POSTGRES_PASSWORD"
echo "JWT_SECRET: $JWT_SECRET"
echo "LITELLM_MASTER_KEY: $LITELLM_MASTER_KEY"
echo "LITELLM_UI_PASSWORD: $LITELLM_UI_PASSWORD"
echo "ADMIN_API_KEY: $ADMIN_API_KEY"
```

### Step 2: Prepare Secret Values

Create a temporary file to store your configuration:

```bash
# Create a secure temporary file
cat > /tmp/litemaas-config.env << EOF
# OAuth Configuration (replace with your actual values)
OAUTH_CLIENT_ID=litemaas-oauth-client
OAUTH_CLIENT_SECRET=your-oauth-client-secret-from-step-4
OAUTH_ISSUER=https://oauth-openshift.apps.cluster.example.com
CLUSTER_DOMAIN=apps.cluster.example.com
NAMESPACE=litemaas

# Generated secure values
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
LITELLM_MASTER_KEY=$LITELLM_MASTER_KEY
LITELLM_UI_PASSWORD=$LITELLM_UI_PASSWORD
ADMIN_API_KEY=$ADMIN_API_KEY
EOF

# Source the configuration
source /tmp/litemaas-config.env
```

### Step 3: Create Secrets Using CLI

```bash
# Create PostgreSQL secret
oc create secret generic postgres-secret \
  --from-literal=username=litemaas_admin \
  --from-literal=password="$POSTGRES_PASSWORD"

# Create backend secret
oc create secret generic backend-secret \
  --from-literal=database-url="postgresql://litemaas_admin:$POSTGRES_PASSWORD@postgres:5432/litemaas" \
  --from-literal=cors-origin="https://litemaas-$NAMESPACE.$CLUSTER_DOMAIN" \
  --from-literal=jwt-secret="$JWT_SECRET" \
  --from-literal=oauth-client-id="$OAUTH_CLIENT_ID" \
  --from-literal=oauth-client-secret="$OAUTH_CLIENT_SECRET" \
  --from-literal=oauth-issuer="$OAUTH_ISSUER" \
  --from-literal=oauth-callback-url="https://litemaas-$NAMESPACE.$CLUSTER_DOMAIN/api/auth/callback" \
  --from-literal=admin-api-keys="$ADMIN_API_KEY" \
  --from-literal=litellm-api-key="$LITELLM_MASTER_KEY"

# Create LiteLLM secret
oc create secret generic litellm-secret \
  --from-literal=database-url="postgresql://litemaas_admin:$POSTGRES_PASSWORD@postgres:5432/litellm" \
  --from-literal=master-key="$LITELLM_MASTER_KEY" \
  --from-literal=ui-username=admin \
  --from-literal=ui-password="$LITELLM_UI_PASSWORD"

# Verify secrets were created
oc get secrets | grep -E "(postgres|backend|litellm)-secret"
```

### Step 4: Alternative - Update YAML Files

If you prefer to use the provided YAML files, edit each secret file:

```bash
# Navigate to the OpenShift deployment directory
cd deployment/openshift

# Edit each secret file and replace the base64 encoded values
# Use this command to encode values:
echo -n "your-actual-value" | base64

# Example for postgres-secret.yaml:
# Replace: bGl0ZW1hYXNfYWRtaW4= with: $(echo -n "litemaas_admin" | base64)
# Replace: Y2hhbmdlLW1lLXBsZWFzZQ== with: $(echo -n "$POSTGRES_PASSWORD" | base64)
```

### Step 5: Clean Up Temporary Files

```bash
# Securely remove temporary configuration
rm -f /tmp/litemaas-config.env
unset POSTGRES_PASSWORD JWT_SECRET LITELLM_MASTER_KEY LITELLM_UI_PASSWORD ADMIN_API_KEY
```

## Deployment Process

### Step 1: Verify Prerequisites

```bash
# Ensure you're in the correct project
oc project litemaas

# Verify secrets exist
oc get secrets | grep -E "(postgres|backend|litellm)-secret"
# Should show 3 secrets

# Check if container images are accessible
oc run test-backend --image=quay.io/rh-aiservice-bu/litemaas-backend:latest --dry-run=client -o yaml > /dev/null
oc run test-frontend --image=quay.io/rh-aiservice-bu/litemaas-frontend:latest --dry-run=client -o yaml > /dev/null
echo "Container images are accessible"
```

### Step 2: Deploy Using Kustomize

```bash
# Navigate to the deployment directory
cd deployment/openshift

# Preview what will be deployed
oc apply -k . --dry-run=client

# Deploy all resources
oc apply -k .

# Alternative: Deploy to a different namespace
oc apply -k . -n your-custom-namespace
```

### Step 3: Monitor Deployment Progress

```bash
# Watch pods as they start
oc get pods -w

# Check deployment status
oc get deployments
oc get statefulsets

# Check routes
oc get routes
```

### Step 4: Wait for All Pods to be Ready

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
# All pods should show STATUS as "Running" and READY as "1/1" or "2/2"
```

## Post-Deployment Configuration

### Step 1: Verify Database Initialization

```bash
# Check PostgreSQL logs
oc logs -l app=postgres --tail=50

# Test database connectivity from backend
oc exec deployment/backend -- curl -f http://localhost:8080/api/v1/health
```

### Step 2: Access LiteLLM Administration UI

1. Get the LiteLLM route URL:

   ```bash
   oc get route litellm -o jsonpath='{.spec.host}'
   # Example: litellm-litemaas.apps.cluster.example.com
   ```

2. Open the LiteLLM UI in your browser:

   ```
   https://litellm-litemaas.apps.cluster.example.com
   ```

3. Login with the credentials from your `litellm-secret`:
   - **Username**: admin
   - **Password**: (the value you set in `LITELLM_UI_PASSWORD`)

### Step 3: Configure Initial Models in LiteLLM

1. In the LiteLLM UI, navigate to **Models**
2. Add your first AI model (example for OpenAI):

   ```json
   {
     "model_name": "gpt-4",
     "litellm_params": {
       "model": "gpt-4",
       "api_key": "your-openai-api-key"
     }
   }
   ```

3. Test the model configuration

### Step 4: Verify LiteMaaS Application

1. Get the frontend route URL:

   ```bash
   oc get route litemaas -o jsonpath='{.spec.host}'
   # Example: litemaas-litemaas.apps.cluster.example.com
   ```

2. Open LiteMaaS in your browser:

   ```
   https://litemaas-litemaas.apps.cluster.example.com
   ```

3. Test OAuth login by clicking the login button

## Accessing the Applications

After successful deployment, you can access:

### LiteMaaS Main Application

- **URL**: `https://litemaas-<namespace>.apps.<cluster-domain>`
- **Purpose**: Main user interface for model subscriptions and API key management
- **Authentication**: OpenShift OAuth

### LiteLLM Administration UI

- **URL**: `https://litellm-<namespace>.apps.<cluster-domain>`
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
oc exec deployment/postgres -- pg_isready -U litemaas_admin -d litemaas
```

**Solutions**:

- Verify `postgres-secret` has correct credentials
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
- Check OAuth client secret is correctly set in `backend-secret`
- Ensure OAuth issuer URL is accessible from within the cluster

#### 4. Route Accessibility Issues

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

#### 5. Secret Configuration Errors

**Symptoms**: Pods failing with missing environment variable errors

**Diagnosis**:

```bash
# Check if secrets exist
oc get secrets

# Verify secret content (be careful not to expose sensitive data)
oc get secret backend-secret -o jsonpath='{.data}' | jq keys
```

**Solutions**:

- Recreate secrets with correct base64 encoding
- Verify all required secret keys are present
- Check secret names match deployment references

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
# Update to a new image version
oc set image deployment/backend backend=quay.io/rh-aiservice-bu/litemaas-backend:v1.1.0
oc set image deployment/frontend frontend=quay.io/rh-aiservice-bu/litemaas-frontend:v1.1.0

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
oc exec -i deployment/postgres -- pg_dump -U litemaas_admin litemaas > litemaas-backup-$(date +%Y%m%d).sql

# Store backup securely (example with persistent volume)
oc create pvc backup-pvc --size=10Gi
oc run backup-job --image=postgres:16-alpine --rm -it --restart=Never \
  --mount-path=/backup --volume-claim-name=backup-pvc \
  -- bash -c "pg_dump -h postgres -U litemaas_admin litemaas > /backup/litemaas-$(date +%Y%m%d).sql"
```

#### Database Restore

```bash
# Restore from backup (CAUTION: This will overwrite existing data)
oc exec -i deployment/postgres -- psql -U litemaas_admin litemaas < litemaas-backup-20241201.sql
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
   - Never commit secrets to version control

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

- **Documentation**: Check the `docs/` directory for detailed guides
- **Issues**: Report problems via GitHub Issues
- **Community**: Join our Discord community for discussions

---

**Note**: This guide assumes a standard OpenShift 4.x installation. Some steps may vary depending on your cluster configuration and available features.
