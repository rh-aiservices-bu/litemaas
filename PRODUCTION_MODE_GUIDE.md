# Production Mode Configuration Guide

This guide explains how to run LiteMaaS in production mode while maintaining frontend functionality.

## Running in Production Mode

```bash
# Run in production mode
NODE_ENV=production npm run dev
```

## Authentication Behavior

### Development Mode (`NODE_ENV=development`)
- ✅ Frontend requests bypass authentication (localhost origins)
- ✅ Swagger docs accessible with logging
- ✅ Development endpoints available
- 📝 All access logged for security monitoring

### Production Mode (`NODE_ENV=production`)
- 🔒 Enhanced security with warnings for frontend bypass
- 🔒 Swagger docs require authentication (admin API key or JWT token)
- ⚠️ Frontend bypass still works (for testing) but with security warnings
- 🚫 Development endpoints hidden (unless `ALLOW_DEV_TOKENS=true`)

## Frontend Authentication Options

### Option 1: Use Frontend Bypass (Current)
The frontend will work automatically using the origin-based bypass:

```typescript
// Automatic - no changes needed in frontend
// Backend detects localhost origins and allows access
```

### Option 2: Use JWT Tokens (Recommended for Production)
Get a development JWT token for the frontend:

```bash
# Get JWT token from backend
curl -X POST http://localhost:8080/api/auth/dev-token \
  -H "Content-Type: application/json" \
  -d '{"username": "developer", "roles": ["admin", "user"]}'
```

Then use the token in frontend requests:
```typescript
// Add to frontend API client
headers: {
  'Authorization': `Bearer ${access_token}`
}
```

### Option 3: Use Admin API Keys
For external API access or testing:

```bash
# Use admin API key
curl -H "Authorization: Bearer ltm_admin_dev123456789" \
  http://localhost:8080/api/subscriptions
```

## Environment Configuration

### Required Environment Variables

```bash
# Allow frontend origins (for bypass functionality)
ALLOWED_FRONTEND_ORIGINS=localhost:3000,localhost:3001,127.0.0.1:3000,127.0.0.1:3001

# Admin API keys for administrative access
ADMIN_API_KEYS=ltm_admin_dev123456789,ltm_admin_test987654321

# Allow development token endpoint in production (optional)
ALLOW_DEV_TOKENS=true
```

### Security Warnings in Production Mode

When running in production mode, you'll see warnings like:

```log
[WARN] Frontend bypass used in production mode - consider implementing proper authentication
```

This is intentional to remind you that the frontend bypass should be replaced with proper JWT authentication in a real production environment.

## Migration Path to Full Production

### Step 1: Implement Frontend Authentication
1. Add login functionality to frontend
2. Store JWT tokens in frontend (localStorage/sessionStorage)
3. Include tokens in all API requests

### Step 2: Disable Frontend Bypass
1. Remove `ALLOWED_FRONTEND_ORIGINS` from environment
2. Or modify the authentication logic to only allow JWT tokens

### Step 3: Secure Environment Variables
1. Use strong, randomly generated admin API keys
2. Set `ALLOW_DEV_TOKENS=false` or remove it
3. Implement proper secret management

## Testing Production Security

### Test Swagger Documentation
```bash
# Should require authentication in production (returns 401)
curl -s -i http://localhost:8080/docs

# Should work with admin API key (returns 302 redirect)
curl -s -i -H "Authorization: Bearer ltm_admin_dev123456789" http://localhost:8080/docs
```

### Test API Endpoints
```bash
# Should work with admin key
curl -H "Authorization: Bearer ltm_admin_dev123456789" \
  http://localhost:8080/api/subscriptions

# Should work with JWT token
curl -H "Authorization: Bearer ${JWT_TOKEN}" \
  http://localhost:8080/api/subscriptions

# Should work with frontend origin
curl -H "Origin: http://localhost:3000" \
  http://localhost:8080/api/subscriptions
```

### Test Development Token Endpoint
```bash
# Should work if ALLOW_DEV_TOKENS=true
curl -X POST http://localhost:8080/api/auth/dev-token \
  -H "Content-Type: application/json" \
  -d '{"username": "test-user"}'
```

## Security Features by Mode

| Feature | Development | Production | Notes |
|---------|-------------|------------|-------|
| Frontend Bypass | ✅ Silent | ⚠️ With warnings | Based on origin headers |
| Swagger Access | ✅ Logged | 🔒 Admin/JWT required | Returns 401 without auth, 302 with admin key |
| Dev Token Endpoint | ✅ Available | 🔒 Configurable | Controlled by `ALLOW_DEV_TOKENS` |
| Admin API Keys | ✅ Full access | ✅ Full access | Always available |
| User API Keys | ✅ Database validated | ✅ Database validated | Full validation |
| Security Logging | 📝 Debug level | ⚠️ Warning level | Enhanced monitoring |

---

**Recommendation**: The current setup allows you to test production mode while maintaining frontend functionality. For actual production deployment, implement proper JWT authentication in the frontend and disable the origin-based bypass.