const http = require('http');

function testEndpoint(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 8080,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data.substring(0, 200) // Truncate response
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing API endpoints...\n');

  const tests = [
    { path: '/api/models', name: 'Models (public)' },
    { path: '/api/subscriptions', name: 'Subscriptions (protected)' },
    { path: '/api/api-keys', name: 'API Keys (protected)' },
    { path: '/api/usage/metrics', name: 'Usage (protected)' }
  ];

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      const result = await testEndpoint(test.path);
      console.log(`  Status: ${result.statusCode}`);
      console.log(`  Response: ${result.data.substring(0, 100)}...\n`);
    } catch (error) {
      console.log(`  Error: ${error.message}\n`);
    }
  }

  // Test with admin API key
  console.log('Testing with admin API key...');
  try {
    const result = await testEndpoint('/api/subscriptions', {
      'Authorization': 'Bearer ltm_admin_dev123456789'
    });
    console.log(`  Status: ${result.statusCode}`);
    console.log(`  Response: ${result.data.substring(0, 100)}...\n`);
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
  }
}

runTests();