#!/usr/bin/env node

const http = require('http');

function checkEndpoint(name, path, headers = {}) {
  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port: 8080,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        Accept: 'application/json, text/plain, */*',
        Origin: 'http://localhost:3000',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          name,
          status: res.statusCode,
          success: res.statusCode === 200,
          hasData: data.length > 0,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        name,
        status: 'ERROR',
        success: false,
        error: err.message,
      });
    });

    req.setTimeout(3000, () => {
      req.destroy();
      resolve({
        name,
        status: 'TIMEOUT',
        success: false,
        error: 'Request timeout',
      });
    });

    req.end();
  });
}

async function checkBackend() {
  console.log('🔍 Checking LiteMaaS Backend Health...\n');

  // Check Swagger documentation access
  console.log('🔐 Testing Swagger Documentation Security:');
  const swaggerCheck = await checkEndpoint('Swagger without auth', '/docs');
  const swaggerIcon = swaggerCheck.success ? '⚠️ ' : '✅';
  const swaggerStatus =
    swaggerCheck.status === 401
      ? 'PROTECTED (401)'
      : swaggerCheck.status === 'ERROR'
        ? `${swaggerCheck.status}: ${swaggerCheck.error}`
        : `ACCESSIBLE (${swaggerCheck.status}) - SECURITY ISSUE!`;
  console.log(`${swaggerIcon} ${swaggerCheck.name}: ${swaggerStatus}`);

  const swaggerAdminCheck = await checkEndpoint('Swagger with admin key', '/docs', {
    Authorization: 'Bearer ltm_admin_dev123456789',
  });
  const swaggerAdminIcon = swaggerAdminCheck.status === 302 ? '✅' : '❌';
  const swaggerAdminStatus =
    swaggerAdminCheck.status === 302
      ? 'ACCESSIBLE (302 redirect)'
      : swaggerAdminCheck.status === 'ERROR'
        ? `${swaggerAdminCheck.status}: ${swaggerAdminCheck.error}`
        : `HTTP ${swaggerAdminCheck.status}`;
  console.log(`${swaggerAdminIcon} ${swaggerAdminCheck.name}: ${swaggerAdminStatus}\n`);

  console.log('🌐 Testing API Endpoints:');
  const checks = [
    { name: 'Models (public)', path: '/api/models?page=1&limit=5' },
    { name: 'Subscriptions (protected)', path: '/api/subscriptions' },
    { name: 'API Keys (protected)', path: '/api/api-keys' },
    { name: 'Usage (protected)', path: '/api/usage/metrics' },
    {
      name: 'Admin API Key Test',
      path: '/api/subscriptions',
      headers: { Authorization: 'Bearer ltm_admin_dev123456789' },
    },
  ];

  const results = [];

  for (const check of checks) {
    const result = await checkEndpoint(check.name, check.path, check.headers);
    results.push(result);

    const statusIcon = result.success ? '✅' : '❌';
    const status =
      result.status === 'ERROR' || result.status === 'TIMEOUT'
        ? `${result.status}: ${result.error}`
        : `HTTP ${result.status}`;

    console.log(`${statusIcon} ${result.name}: ${status}`);
  }

  console.log('\n📊 Summary:');
  const successful = results.filter((r) => r.success).length;
  const total = results.length;

  // Check security status
  const isSwaggerProtected = swaggerCheck.status === 401;
  const canAccessWithAdmin = swaggerAdminCheck.status === 302;

  if (successful === total && isSwaggerProtected && canAccessWithAdmin) {
    console.log(`🎉 All checks passed (${successful}/${total})! Backend is working correctly.`);
    console.log('🔒 Swagger documentation properly secured in production mode.');
    console.log('✨ Frontend authentication should work properly.');
  } else {
    console.log(`⚠️  Issues detected:`);
    if (successful !== total) {
      console.log(`  - API endpoints: ${successful}/${total} checks passed`);
    }
    if (!isSwaggerProtected) {
      console.log(`  - 🚨 SECURITY: Swagger documentation accessible without authentication!`);
      console.log(`    This should only happen in development mode.`);
    }
    if (!canAccessWithAdmin && isSwaggerProtected) {
      console.log(`  - ❌ Admin API key cannot access Swagger documentation`);
    }

    const failed = results.filter((r) => !r.success);
    if (failed.some((f) => f.status === 'ERROR' && f.error.includes('ECONNREFUSED'))) {
      console.log('🚨 Backend appears to not be running on port 8080.');
      console.log('💡 Try running: cd backend && npm run dev');
    }
  }

  console.log('\n🔧 If you see authentication issues in the frontend:');
  console.log('1. Make sure this script shows all green checkmarks');
  console.log('2. Check that frontend is running on http://localhost:3000');
  console.log('3. Verify Vite proxy is configured correctly in vite.config.ts');
}

checkBackend().catch(console.error);
