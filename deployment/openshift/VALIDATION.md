# LiteMaaS OpenShift Deployment Validation

This document provides a comprehensive checklist for validating your LiteMaaS deployment on OpenShift.

## Pre-Deployment Validation

### 1. Configuration Files Generated

After running `./preparation.sh`, verify all `.local` files were created:

```bash
ls -la *.local kustomization.yaml
```

**Expected output:**

```
-rw-r--r-- backend-deployment.yaml.local
-rw-r--r-- backend-secret.yaml.local
-rw-r--r-- frontend-deployment.yaml.local
-rw-r--r-- kustomization.yaml
-rw-r--r-- litellm-secret.yaml.local
-rw-r--r-- namespace.yaml.local
-rw-r--r-- postgres-secret.yaml.local
```

### 2. Namespace Configuration

Verify namespace in kustomization.yaml matches your desired namespace:

```bash
grep "namespace:" kustomization.yaml
```

**Expected output:**

```
namespace: <your-namespace>
```

### 3. Secret Values Substituted

Check that template variables were replaced (should see no `${...}` patterns):

```bash
grep '\${' *.local
```

**Expected output:** (empty - no matches)

If you see any `${VARIABLE_NAME}` patterns, the environment variable was not set in `user-values.env`.

## Post-Deployment Validation

### 1. Namespace Created

```bash
oc get namespace <your-namespace>
```

**Expected output:**

```
NAME              STATUS   AGE
<your-namespace>  Active   <time>
```

### 2. All Pods Running

```bash
oc get pods -n <your-namespace>
```

**Expected output:**

```
NAME                        READY   STATUS    RESTARTS   AGE
backend-xxxxxxxxxx-xxxxx    1/1     Running   0          <time>
frontend-xxxxxxxxxx-xxxxx   1/1     Running   0          <time>
litellm-xxxxxxxxxx-xxxxx    1/1     Running   0          <time>
postgres-0                  1/1     Running   0          <time>
```

✅ All pods should show `1/1 Running` status.

### 3. All Services Created

```bash
oc get svc -n <your-namespace>
```

**Expected output:**

```
NAME       TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
backend    ClusterIP   172.30.x.x       <none>        8080/TCP   <time>
frontend   ClusterIP   172.30.x.x       <none>        8080/TCP   <time>
litellm    ClusterIP   172.30.x.x       <none>        4000/TCP   <time>
postgres   ClusterIP   172.30.x.x       <none>        5432/TCP   <time>
```

### 4. Routes Created and Accessible

```bash
oc get routes -n <your-namespace>
```

**Expected output:**

```
NAME       HOST/PORT                                              PATH   SERVICES   PORT   TERMINATION   WILDCARD
litemaas   litemaas-<namespace>.<cluster-domain>                         frontend   http   edge          None
litellm    litellm-<namespace>.<cluster-domain>                          litellm    http   edge          None
```

### 5. Secrets Created

```bash
oc get secrets -n <your-namespace> | grep -E "backend-secret|postgres-secret|litellm-secret"
```

**Expected output:**

```
backend-secret    Opaque   7      <time>
litellm-secret    Opaque   3      <time>
postgres-secret   Opaque   2      <time>
```

## Component-Specific Validation

### PostgreSQL Database

#### Check Pod is Running

```bash
oc get pod -n <your-namespace> -l app=postgres
```

**Expected output:**

```
NAME         READY   STATUS    RESTARTS   AGE
postgres-0   1/1     Running   0          <time>
```

#### Check Persistent Volume Claim

```bash
oc get pvc -n <your-namespace>
```

**Expected output:**

```
NAME                       STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
postgres-storage-postgres-0   Bound    pvc-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   10Gi       RWO            <class>        <time>
```

#### Test Database Connection

```bash
oc exec -n <your-namespace> postgres-0 -- psql -U litemaas_admin -d litemaas_db -c '\dt'
```

**Expected output:** List of database tables (users, teams, models, subscriptions, etc.)

### Backend API

#### Check Pod Logs

```bash
oc logs -n <your-namespace> -l app=backend --tail=50
```

**Look for:**

- ✅ `Server listening at http://0.0.0.0:8080`
- ✅ `Database connected successfully`
- ✅ `Admin analytics configuration loaded`
- ❌ No error messages about database connection
- ❌ No error messages about OAuth configuration

#### Test Health Endpoint

```bash
oc exec -n <your-namespace> -l app=backend -- curl -s http://localhost:8080/api/v1/health
```

**Expected output:**

```json
{
  "status": "healthy",
  "timestamp": "<iso-timestamp>",
  "uptime": <seconds>,
  "version": "<version>"
}
```

#### Test API Documentation

```bash
oc exec -n <your-namespace> -l app=backend -- curl -s http://localhost:8080/docs
```

**Expected output:** HTML content starting with `<!DOCTYPE html>`

### Frontend Application

#### Check Pod Logs

```bash
oc logs -n <your-namespace> -l app=frontend --tail=20
```

**Look for:**

- ✅ NGINX startup messages
- ❌ No error messages

#### Test Frontend Serving

```bash
oc exec -n <your-namespace> -l app=frontend -- curl -s http://localhost:8080/ | head -20
```

**Expected output:** HTML content with `<!DOCTYPE html>` and references to LiteMaaS

#### Test Public Access

```bash
# Get the route URL
FRONTEND_URL=$(oc get route litemaas -n <your-namespace> -o jsonpath='{.spec.host}')
curl -sI https://$FRONTEND_URL
```

**Expected output:**

```
HTTP/2 200
content-type: text/html
...
```

### LiteLLM Service

#### Check Pod Logs

```bash
oc logs -n <your-namespace> -l app=litellm --tail=50
```

**Look for:**

- ✅ `uvicorn.access` log messages
- ✅ Database initialization messages
- ❌ No error messages about database connection

#### Test Health Endpoints

```bash
oc exec -n <your-namespace> -l app=litellm -- curl -s http://localhost:4000/health/liveness
oc exec -n <your-namespace> -l app=litellm -- curl -s http://localhost:4000/health/readiness
```

**Expected output (both):**

```
OK
```

#### Test Public Access

```bash
# Get the route URL
LITELLM_URL=$(oc get route litellm -n <your-namespace> -o jsonpath='{.spec.host}')
curl -sI https://$LITELLM_URL
```

**Expected output:**

```
HTTP/2 200
...
```

## Integration Validation

### Backend → PostgreSQL Connection

```bash
oc exec -n <your-namespace> -l app=backend -- curl -s http://localhost:8080/api/v1/health/ready | jq
```

**Expected output:**

```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "litellm": "ok"
  }
}
```

### Backend → LiteLLM Connection

Check backend can reach LiteLLM:

```bash
oc logs -n <your-namespace> -l app=backend | grep -i litellm
```

**Look for:** Model sync messages, no connection errors

### OAuth Configuration

Test OAuth flow (requires browser):

1. Navigate to `https://litemaas-<namespace>.<cluster-domain>`
2. Click "Sign In" or similar
3. Should redirect to OpenShift OAuth login
4. After login, should redirect back to LiteMaaS with authenticated session

**If OAuth fails:**

- Check `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` in backend-secret
- Verify OAuth client is registered in OpenShift
- Check redirect URLs are registered correctly

## Performance Validation

### Resource Usage

Check pod resource consumption:

```bash
oc adm top pods -n <your-namespace>
```

**Expected ranges (with default values):**

```
NAME                        CPU(cores)   MEMORY(bytes)
backend-xxx                 10-100m      128Mi-512Mi
frontend-xxx                5-50m        64Mi-256Mi
litellm-xxx                 50-200m      256Mi-1Gi
postgres-0                  20-100m      128Mi-512Mi
```

### Response Times

Test API response time:

```bash
time oc exec -n <your-namespace> -l app=backend -- curl -s http://localhost:8080/api/v1/health
```

**Expected:** < 1 second

## Troubleshooting Common Issues

### Pods Not Starting

**Symptom:** Pods stuck in `Pending`, `CrashLoopBackOff`, or `Error` state

**Check:**

```bash
oc describe pod <pod-name> -n <your-namespace>
oc logs <pod-name> -n <your-namespace>
```

**Common causes:**

- Insufficient resources (CPU/memory)
- Image pull errors (check image names in kustomization.yaml)
- Secret not found (check secret names match)
- Init container failures (database not ready)

### Database Connection Failures

**Symptom:** Backend logs show database connection errors

**Check:**

1. PostgreSQL pod is running:

   ```bash
   oc get pod -n <your-namespace> postgres-0
   ```

2. Database credentials in backend-secret match postgres-secret:

   ```bash
   oc get secret backend-secret -n <your-namespace> -o jsonpath='{.data.database-url}' | base64 -d
   ```

3. Database is accepting connections:

   ```bash
   oc exec postgres-0 -n <your-namespace> -- pg_isready
   ```

### OAuth Authentication Failures

**Symptom:** Cannot log in, redirects fail, or "invalid client" errors

**Check:**

1. OAuth client exists in OpenShift:

   ```bash
   oc get oauthclient litemaas-oauth-client
   ```

2. Redirect URIs include your frontend route:

   ```bash
   oc get oauthclient litemaas-oauth-client -o yaml | grep -A 10 redirectURIs
   ```

3. Backend OAuth configuration:

   ```bash
   oc get secret backend-secret -n <your-namespace> -o jsonpath='{.data.oauth-client-id}' | base64 -d
   ```

### LiteLLM Not Accessible

**Symptom:** Backend cannot connect to LiteLLM

**Check:**

1. LiteLLM service exists:

   ```bash
   oc get svc litellm -n <your-namespace>
   ```

2. LiteLLM pod is running and healthy:

   ```bash
   oc get pod -n <your-namespace> -l app=litellm
   oc logs -n <your-namespace> -l app=litellm --tail=100
   ```

3. Backend can resolve LiteLLM service:

   ```bash
   oc exec -n <your-namespace> -l app=backend -- nslookup litellm
   ```

## Post-Validation Steps

Once all validations pass:

1. **Create your first model** in LiteMaaS (via UI or directly in LiteLLM)
2. **Assign roles** to users (admin, adminReadonly, user)
3. **Create API keys** for users
4. **Test AI model requests** through LiteLLM proxy

## Monitoring and Maintenance

### Regular Health Checks

Create a monitoring script:

```bash
#!/bin/bash
# health-check.sh

NAMESPACE="<your-namespace>"

echo "=== Pod Status ==="
oc get pods -n $NAMESPACE

echo -e "\n=== Service Status ==="
oc get svc -n $NAMESPACE

echo -e "\n=== Route Status ==="
oc get routes -n $NAMESPACE

echo -e "\n=== Backend Health ==="
oc exec -n $NAMESPACE -l app=backend -- curl -s http://localhost:8080/api/v1/health

echo -e "\n=== LiteLLM Health ==="
oc exec -n $NAMESPACE -l app=litellm -- curl -s http://localhost:4000/health/liveness
```

Run periodically:

```bash
chmod +x health-check.sh
./health-check.sh
```

### Log Collection

Collect logs for troubleshooting:

```bash
#!/bin/bash
# collect-logs.sh

NAMESPACE="<your-namespace>"
OUTPUT_DIR="litemaas-logs-$(date +%Y%m%d-%H%M%S)"

mkdir -p $OUTPUT_DIR

oc logs -n $NAMESPACE -l app=backend --tail=1000 > $OUTPUT_DIR/backend.log
oc logs -n $NAMESPACE -l app=frontend --tail=1000 > $OUTPUT_DIR/frontend.log
oc logs -n $NAMESPACE -l app=litellm --tail=1000 > $OUTPUT_DIR/litellm.log
oc logs -n $NAMESPACE postgres-0 --tail=1000 > $OUTPUT_DIR/postgres.log

oc get all -n $NAMESPACE -o yaml > $OUTPUT_DIR/resources.yaml
oc get events -n $NAMESPACE --sort-by='.lastTimestamp' > $OUTPUT_DIR/events.txt

echo "Logs collected in: $OUTPUT_DIR"
```

## Additional Resources

- [OpenShift Deployment Guide](../../docs/deployment/openshift-deployment.md) - Complete deployment instructions
- [Configuration Guide](../../docs/deployment/configuration.md) - Environment variable reference
- [Troubleshooting Guide](../../docs/deployment/troubleshooting.md) - Common issues and solutions
- [LiteMaaS Documentation](../../docs/README.md) - Complete documentation index
