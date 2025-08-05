import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
export const errors = new Counter('errors');
export const errorRate = new Rate('error_rate');
export const apiResponseTime = new Trend('api_response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.1'], // Error rate should be less than 10%
    error_rate: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test-api-key';

// Test scenarios
const scenarios = {
  getModels: {
    weight: 30,
    exec: 'getModels',
  },
  getSubscriptions: {
    weight: 20,
    exec: 'getSubscriptions',
  },
  getApiKeys: {
    weight: 20,
    exec: 'getApiKeys',
  },
  getUsage: {
    weight: 15,
    exec: 'getUsage',
  },
  createSubscription: {
    weight: 10,
    exec: 'createSubscription',
  },
  getSubscriptionPricing: {
    weight: 5,
    exec: 'getSubscriptionPricing',
  },
  createCompletion: {
    weight: 15,
    exec: 'createCompletion',
  },
};

// Authentication helper
function getAuthHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Test function: Get models
export function getModels() {
  const response = http.get(`${BASE_URL}/api/v1/models`, {
    headers: getAuthHeaders(),
  });

  const success = check(response, {
    'get models status is 200': (r) => r.status === 200,
    'get models response time < 500ms': (r) => r.timings.duration < 500,
    'get models has data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data.data) && data.data.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    errors.add(1);
    errorRate.add(true);
  } else {
    errorRate.add(false);
  }

  apiResponseTime.add(response.timings.duration);
  sleep(1);
}

// Test function: Get subscriptions
export function getSubscriptions() {
  const response = http.get(`${BASE_URL}/api/v1/subscriptions`, {
    headers: getAuthHeaders(),
  });

  const success = check(response, {
    'get subscriptions status is 200': (r) => r.status === 200,
    'get subscriptions response time < 500ms': (r) => r.timings.duration < 500,
  });

  if (!success) {
    errors.add(1);
    errorRate.add(true);
  } else {
    errorRate.add(false);
  }

  apiResponseTime.add(response.timings.duration);
  sleep(1);
}

// Test function: Get API keys
export function getApiKeys() {
  const response = http.get(`${BASE_URL}/api/v1/api-keys`, {
    headers: getAuthHeaders(),
  });

  const success = check(response, {
    'get api keys status is 200': (r) => r.status === 200,
    'get api keys response time < 500ms': (r) => r.timings.duration < 500,
  });

  if (!success) {
    errors.add(1);
    errorRate.add(true);
  } else {
    errorRate.add(false);
  }

  apiResponseTime.add(response.timings.duration);
  sleep(1);
}

// Test function: Get usage statistics
export function getUsage() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date();

  const response = http.get(
    `${BASE_URL}/api/v1/usage?start=${startDate.toISOString()}&end=${endDate.toISOString()}`,
    {
      headers: getAuthHeaders(),
    },
  );

  const success = check(response, {
    'get usage status is 200': (r) => r.status === 200,
    'get usage response time < 1000ms': (r) => r.timings.duration < 1000, // Usage queries can be slower
  });

  if (!success) {
    errors.add(1);
    errorRate.add(true);
  } else {
    errorRate.add(false);
  }

  apiResponseTime.add(response.timings.duration);
  sleep(1);
}

// Test function: Create subscription
export function createSubscription() {
  const payload = JSON.stringify({
    modelId: 'gpt-3.5-turbo',
    quotaRequests: 10000,
    quotaTokens: 1000000,
  });

  const response = http.post(`${BASE_URL}/api/v1/subscriptions`, payload, {
    headers: getAuthHeaders(),
  });

  const success = check(response, {
    'create subscription status is 201': (r) => r.status === 201,
    'create subscription response time < 1000ms': (r) => r.timings.duration < 1000,
    'create subscription has id': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.id && data.modelId === 'gpt-3.5-turbo';
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    errors.add(1);
    errorRate.add(true);
  } else {
    errorRate.add(false);
  }

  apiResponseTime.add(response.timings.duration);
  sleep(1);
}

// Test function: Get subscription pricing
export function getSubscriptionPricing() {
  // Use a mock subscription ID for testing
  const subscriptionId = 'sub-test-123';

  const response = http.get(`${BASE_URL}/api/v1/subscriptions/${subscriptionId}/pricing`, {
    headers: getAuthHeaders(),
  });

  const success = check(response, {
    'get subscription pricing status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'get subscription pricing response time < 500ms': (r) => r.timings.duration < 500,
    'get subscription pricing has valid structure': (r) => {
      if (r.status === 404) return true; // 404 is expected for non-existent subscription
      try {
        const data = JSON.parse(r.body);
        return (
          data.subscriptionId &&
          typeof data.inputCostPerToken === 'number' &&
          typeof data.outputCostPerToken === 'number'
        );
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    errors.add(1);
    errorRate.add(true);
  } else {
    errorRate.add(false);
  }

  apiResponseTime.add(response.timings.duration);
  sleep(1);
}

// Test function: Create completion
export function createCompletion() {
  const payload = JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: 'Hello, this is a performance test message. Please respond briefly.',
      },
    ],
    max_tokens: 50,
    temperature: 0.7,
  });

  const response = http.post(`${BASE_URL}/api/v1/completions`, payload, {
    headers: getAuthHeaders(),
  });

  const success = check(response, {
    'create completion status is 200': (r) => r.status === 200,
    'create completion response time < 5000ms': (r) => r.timings.duration < 5000, // LLM calls can be slower
    'create completion has choices': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.choices && data.choices.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    errors.add(1);
    errorRate.add(true);
  } else {
    errorRate.add(false);
  }

  apiResponseTime.add(response.timings.duration);
  sleep(2); // Longer sleep for completion requests
}

// Main test function
export default function () {
  // Randomly select a scenario based on weights
  const rand = Math.random() * 100;
  let cumulative = 0;

  for (const [scenarioName, config] of Object.entries(scenarios)) {
    cumulative += config.weight;
    if (rand <= cumulative) {
      // Execute the selected scenario
      switch (scenarioName) {
        case 'getModels':
          getModels();
          break;
        case 'getSubscriptions':
          getSubscriptions();
          break;
        case 'getApiKeys':
          getApiKeys();
          break;
        case 'getUsage':
          getUsage();
          break;
        case 'createSubscription':
          createSubscription();
          break;
        case 'getSubscriptionPricing':
          getSubscriptionPricing();
          break;
        case 'createCompletion':
          createCompletion();
          break;
      }
      break;
    }
  }
}

// Setup function (runs once at the beginning)
export function setup() {
  console.log('Starting performance test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Test scenarios:', Object.keys(scenarios).join(', '));

  // Verify the API is accessible
  const response = http.get(`${BASE_URL}/health`);
  if (response.status !== 200) {
    throw new Error(`API health check failed: ${response.status}`);
  }

  return { timestamp: new Date().toISOString() };
}

// Teardown function (runs once at the end)
export function teardown(data) {
  console.log('Performance test completed at:', new Date().toISOString());
  console.log('Test started at:', data.timestamp);
}
