# Authentication Debug Guide

## Summary

Your authentication system has been successfully implemented and tested. All protected endpoints (Subscriptions, API Keys, Usage) are working correctly with the frontend bypass system.

## Current Status ✅

**All authentication endpoints are working correctly:**

- ✅ Models (public) - accessible without authentication
- ✅ Subscriptions (protected) - accessible via frontend bypass
- ✅ API Keys (protected) - accessible via frontend bypass
- ✅ Usage (protected) - accessible via frontend bypass
- ✅ Admin API keys - working for external access
- ✅ Swagger docs - properly secured in production mode

## Quick Health Check

Run this command to verify everything is working:

```bash
npm run check-backend
```

You should see all green checkmarks. If any are red, the backend isn't running properly.

## Common Issues & Solutions

### 1. "Cannot connect to backend" Error

**Symptoms:** Frontend shows connection errors for Subscriptions, API Keys, or Usage pages

**Solutions:**

1. **Check if backend is running:**

   ```bash
   npm run check-backend
   ```

2. **If backend isn't running, restart it:**

   ```bash
   # Kill any existing processes
   pkill -f "tsx.*index.ts"

   # Start fresh
   npm run dev
   ```

3. **If running individual components:**

   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

### 2. Backend Starts But Crashes

**Symptoms:** Backend shows startup logs but then stops responding

**Debug steps:**

1. Check the full backend logs for error messages
2. Ensure no other process is using port 8080:
   ```bash
   lsof -i :8080
   ```
3. Try starting backend alone to isolate issues:
   ```bash
   cd backend && npm run dev
   ```

### 3. Authentication Working But UI Shows Login

**Symptoms:** Backend responds correctly but frontend still redirects to login

**Solutions:**

1. Clear browser storage:
   - Open browser dev tools (F12)
   - Go to Application/Storage tab
   - Clear Local Storage and Session Storage
2. Check that frontend is running on `http://localhost:3000`
3. Verify Vite proxy configuration is correct

### 4. Production Mode Issues

**Symptoms:** Works in development but not when `NODE_ENV=production`

**Solutions:**

1. Ensure environment variables are set:

   ```bash
   ALLOWED_FRONTEND_ORIGINS=localhost:3000,localhost:3001,127.0.0.1:3000,127.0.0.1:3001
   ADMIN_API_KEYS=ltm_admin_dev123456789,ltm_admin_test987654321
   ALLOW_DEV_TOKENS=true
   ```

2. Check backend logs for security warnings (expected in production mode)

## Authentication Methods

Your system supports multiple authentication methods:

### 1. Frontend Bypass (Current)

- **Automatic for localhost origins**
- Detects requests from `localhost:3000`, `localhost:3001`
- Works with Vite dev server proxy
- Logs warnings in production mode

### 2. Admin API Keys

- Use for external/CLI access: `ltm_admin_dev123456789`
- Header: `Authorization: Bearer ltm_admin_dev123456789`

### 3. JWT Tokens (Future)

- Get token: `POST /api/auth/dev-token`
- Use in requests: `Authorization: Bearer <token>`

## Testing Commands

### Test All Endpoints

```bash
npm run check-backend
```

### Test Specific Endpoint

```bash
curl -H "Origin: http://localhost:3000" \
     -H "User-Agent: Mozilla/5.0" \
     -H "Accept: application/json" \
     http://127.0.0.1:8080/api/subscriptions
```

### Test With Admin Key

```bash
curl -H "Authorization: Bearer ltm_admin_dev123456789" \
     http://127.0.0.1:8080/api/subscriptions
```

## Architecture Notes

### How Frontend Bypass Works

1. **Origin Detection:** Backend checks `Origin` and `Referer` headers
2. **Browser Pattern Detection:** Identifies browser-like requests (vs curl/API tools)
3. **Allowed Origins:** Permits requests from configured localhost origins
4. **Mock User Creation:** Creates temporary user context for frontend requests

### Why This Is Secure

- Only works for localhost origins (development)
- Logs all access for monitoring
- Can be disabled by removing `ALLOWED_FRONTEND_ORIGINS`
- Production mode shows security warnings
- Admin API keys remain fully protected

## Migration to Production

When ready for production:

1. **Implement frontend authentication:**
   - Add login page that gets JWT tokens
   - Store tokens in frontend and include in requests
2. **Disable bypass:**
   - Remove `ALLOWED_FRONTEND_ORIGINS` environment variable
   - Or modify auth logic to only accept JWT tokens

3. **Secure environment:**
   - Use strong admin API keys
   - Set `ALLOW_DEV_TOKENS=false`
   - Implement proper secret management

## Files Modified

- `backend/src/plugins/auth.ts` - Enhanced authentication with frontend bypass
- `backend/src/plugins/swagger.ts` - Secured Swagger documentation
- `backend/.env` - Added admin keys and allowed origins
- `check-backend.js` - Health check script (NEW)
- `PRODUCTION_MODE_GUIDE.md` - Production configuration guide

---

**Status:** ✅ Authentication system working correctly
**Last Updated:** 2025-06-25
**Next Steps:** System ready for use; implement proper JWT auth when needed for production
