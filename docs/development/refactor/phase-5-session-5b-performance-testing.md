# Phase 5, Session 5B: Performance Testing

**Phase**: 5 - Performance & Observability
**Session**: 5B - Performance Testing
**Duration**: 6-8 hours
**Priority**: 🟢 MEDIUM
**Issues**: Comprehensive performance validation and load testing

---

## Navigation

- **Previous Session**: [Session 5A: Database Optimization](./phase-5-session-5a-database-optimization.md)
- **Next Session**: [Session 5C: Monitoring & Metrics](./phase-5-session-5c-monitoring-metrics.md)
- **Parent Document**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

### Session Overview

Session 5B focuses on comprehensive performance testing to validate that the admin analytics feature can handle production workloads. This includes load testing, stress testing, and establishing performance benchmarks.

### Prerequisites

Before starting Session 5B, ensure:

- ✅ Session 5A (Database Optimization) completed
- ✅ All database indexes in place
- ✅ Staging environment with production-like resources
- ✅ Load testing tools installed (k6, Artillery, or Apache JMeter)
- ✅ Monitoring tools configured (optional but recommended)

### Related Documentation

- [Database Optimization Session](./phase-5-session-5a-database-optimization.md)
- [Admin Analytics Implementation Plan](../features/admin-usage-analytics-implementation-plan.md)
- [Performance Requirements](../../backend/CLAUDE.md#performance)

---

## Session 5B Objectives

### Primary Goals

1. **Load Testing**: Validate system handles expected production load
2. **Stress Testing**: Determine breaking points and bottlenecks
3. **Benchmark Establishment**: Document baseline performance metrics
4. **Scalability Analysis**: Identify scaling limitations
5. **Performance Documentation**: Create performance test suite and reports

### Deliverables

- [ ] Load test suite (k6 or Artillery scripts)
- [ ] Stress test results and analysis
- [ ] Performance benchmark documentation
- [ ] Scalability recommendations
- [ ] Automated performance CI/CD integration

### Success Metrics

- **Throughput**: 100 requests/second sustained for analytics endpoints
- **Latency**: p50 < 200ms, p95 < 500ms, p99 < 1s
- **Error Rate**: < 0.1% under normal load
- **Concurrency**: Support 50 concurrent users
- **Data Volume**: Handle 10,000 users, 365 days of data

---

## Implementation Steps

### Step 5B.1: Setup Performance Testing Environment (1 hour)

#### Objectives

- Install and configure load testing tools
- Prepare test data sets
- Configure monitoring for performance tests

#### Pre-Work Checklist

- [ ] Choose load testing tool (k6 recommended)
- [ ] Staging environment ready
- [ ] Test user accounts created
- [ ] Authentication tokens generated

#### Implementation

**Install k6 Load Testing Tool**:

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker (alternative)
docker pull grafana/k6:latest

# Verify installation
k6 version
```

**Create Test Data Setup Script**:

**File**: `backend/tests/performance/setup-test-data.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { faker } from '@faker-js/faker';

interface TestDataConfig {
  users: number;
  daysOfData: number;
  requestsPerDay: number;
  modelsCount: number;
}

export async function setupPerformanceTestData(
  fastify: FastifyInstance,
  config: TestDataConfig,
): Promise<void> {
  console.log('Setting up performance test data...', config);

  // 1. Create test users
  const userIds = await createTestUsers(fastify, config.users);
  console.log(`Created ${userIds.length} test users`);

  // 2. Create API keys for users
  const apiKeys = await createAPIKeys(fastify, userIds);
  console.log(`Created ${apiKeys.length} API keys`);

  // 3. Generate usage data
  await generateUsageData(fastify, {
    apiKeys,
    daysOfData: config.daysOfData,
    requestsPerDay: config.requestsPerDay,
    modelsCount: config.modelsCount,
  });
  console.log('Generated usage data');

  // 4. Build cache
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - config.daysOfData);
  const endDate = new Date();

  await buildCache(fastify, startDate, endDate);
  console.log('Built daily usage cache');

  console.log('Performance test data setup complete');
}

async function createTestUsers(fastify: FastifyInstance, count: number): Promise<string[]> {
  const userIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const result = await fastify.pg.query(
      `
      INSERT INTO users (username, email, role)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [`perftest_user_${i}`, `perftest${i}@example.com`, i % 10 === 0 ? 'admin' : 'user'],
    );
    userIds.push(result.rows[0].id);
  }

  return userIds;
}

async function createAPIKeys(fastify: FastifyInstance, userIds: string[]): Promise<string[]> {
  const apiKeys: string[] = [];

  for (const userId of userIds) {
    const keyHash = faker.string.alphanumeric(32);
    await fastify.pg.query(
      `
      INSERT INTO api_keys (user_id, key_hash, name)
      VALUES ($1, $2, $3)
      `,
      [userId, keyHash, `Test Key for ${userId}`],
    );
    apiKeys.push(keyHash);
  }

  return apiKeys;
}

async function generateUsageData(
  fastify: FastifyInstance,
  config: {
    apiKeys: string[];
    daysOfData: number;
    requestsPerDay: number;
    modelsCount: number;
  },
): Promise<void> {
  const models = [
    'gpt-4',
    'gpt-3.5-turbo',
    'claude-3-opus',
    'claude-3-sonnet',
    'mistral-large',
  ].slice(0, config.modelsCount);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - config.daysOfData);

  // Generate usage records in batches
  const batchSize = 1000;
  let totalRecords = 0;

  for (let day = 0; day < config.daysOfData; day++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + day);

    const records = [];

    for (let i = 0; i < config.requestsPerDay; i++) {
      const apiKey = config.apiKeys[Math.floor(Math.random() * config.apiKeys.length)];
      const model = models[Math.floor(Math.random() * models.length)];

      records.push({
        api_key: apiKey,
        model,
        request_id: faker.string.uuid(),
        startTime: currentDate.toISOString(),
        endTime: new Date(currentDate.getTime() + 5000).toISOString(),
        total_tokens: faker.number.int({ min: 100, max: 5000 }),
        prompt_tokens: faker.number.int({ min: 50, max: 3000 }),
        completion_tokens: faker.number.int({ min: 50, max: 2000 }),
        response_cost: faker.number.float({ min: 0.001, max: 0.5, precision: 0.0001 }),
      });

      if (records.length >= batchSize) {
        await insertUsageBatch(fastify, records);
        totalRecords += records.length;
        records.length = 0;
      }
    }

    // Insert remaining records
    if (records.length > 0) {
      await insertUsageBatch(fastify, records);
      totalRecords += records.length;
    }

    if (day % 10 === 0) {
      console.log(`Generated data for ${day + 1} days (${totalRecords} records)`);
    }
  }

  console.log(`Total usage records generated: ${totalRecords}`);
}

async function insertUsageBatch(fastify: FastifyInstance, records: any[]): Promise<void> {
  const query = `
    INSERT INTO litellm_usage (
      api_key, model, request_id, "startTime", "endTime",
      total_tokens, prompt_tokens, completion_tokens, response_cost
    )
    SELECT * FROM UNNEST(
      $1::text[],
      $2::text[],
      $3::text[],
      $4::timestamp[],
      $5::timestamp[],
      $6::int[],
      $7::int[],
      $8::int[],
      $9::numeric[]
    );
  `;

  await fastify.pg.query(query, [
    records.map((r) => r.api_key),
    records.map((r) => r.model),
    records.map((r) => r.request_id),
    records.map((r) => r.startTime),
    records.map((r) => r.endTime),
    records.map((r) => r.total_tokens),
    records.map((r) => r.prompt_tokens),
    records.map((r) => r.completion_tokens),
    records.map((r) => r.response_cost),
  ]);
}

async function buildCache(fastify: FastifyInstance, startDate: Date, endDate: Date): Promise<void> {
  // Call cache rebuild endpoint or service method
  // This would be implemented based on your actual cache rebuild logic
  console.log('Building cache from', startDate, 'to', endDate);
}
```

**Run Test Data Setup**:

```bash
# Run setup script
npm --prefix backend run test:perf:setup

# Verify data created
psql -h localhost -U litemaas -d litemaas -c "
  SELECT COUNT(*) FROM users WHERE username LIKE 'perftest_%';
  SELECT COUNT(*) FROM litellm_usage;
  SELECT COUNT(*) FROM daily_usage_cache;
"
```

---

### Step 5B.2: Create Load Test Scripts (1.5-2 hours)

#### Objectives

- Create k6 load test scripts for all endpoints
- Configure realistic load scenarios
- Add performance assertions

#### Implementation

**Create Base Load Test Script**:

**File**: `backend/tests/performance/load-test-analytics.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const analyticsLatency = new Trend('analytics_latency');
const userBreakdownLatency = new Trend('user_breakdown_latency');
const modelBreakdownLatency = new Trend('model_breakdown_latency');

// Test configuration
export const options = {
  stages: [
    // Ramp up to 10 VUs over 1 minute
    { duration: '1m', target: 10 },
    // Stay at 10 VUs for 3 minutes
    { duration: '3m', target: 10 },
    // Ramp up to 50 VUs over 1 minute
    { duration: '1m', target: 50 },
    // Stay at 50 VUs for 5 minutes (sustained load)
    { duration: '5m', target: 50 },
    // Ramp down to 0 VUs over 1 minute
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    // 95% of requests must complete within 500ms
    analytics_latency: ['p(95)<500'],
    user_breakdown_latency: ['p(95)<1000'],
    model_breakdown_latency: ['p(95)<1000'],
    // Error rate must be below 1%
    errors: ['rate<0.01'],
    // 95% of requests must return 200
    http_req_failed: ['rate<0.05'],
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';
const API_TOKEN = __ENV.API_TOKEN || 'test-token';

const filters = {
  startDate: '2024-01-01',
  endDate: '2024-03-31',
};

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_TOKEN}`,
  };

  // Test 1: Analytics endpoint
  const analyticsStart = Date.now();
  const analyticsRes = http.post(
    `${BASE_URL}/api/v1/admin/usage/analytics`,
    JSON.stringify(filters),
    { headers },
  );
  analyticsLatency.add(Date.now() - analyticsStart);

  check(analyticsRes, {
    'analytics status is 200': (r) => r.status === 200,
    'analytics has data': (r) => JSON.parse(r.body).metrics !== undefined,
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: User breakdown endpoint
  const userStart = Date.now();
  const userRes = http.post(
    `${BASE_URL}/api/v1/admin/usage/user-breakdown`,
    JSON.stringify(filters),
    { headers },
  );
  userBreakdownLatency.add(Date.now() - userStart);

  check(userRes, {
    'user breakdown status is 200': (r) => r.status === 200,
    'user breakdown has data': (r) => JSON.parse(r.body).data !== undefined,
  }) || errorRate.add(1);

  sleep(1);

  // Test 3: Model breakdown endpoint
  const modelStart = Date.now();
  const modelRes = http.post(
    `${BASE_URL}/api/v1/admin/usage/model-breakdown`,
    JSON.stringify(filters),
    { headers },
  );
  modelBreakdownLatency.add(Date.now() - modelStart);

  check(modelRes, {
    'model breakdown status is 200': (r) => r.status === 200,
    'model breakdown has data': (r) => JSON.parse(r.body).data !== undefined,
  }) || errorRate.add(1);

  sleep(2);
}

export function handleSummary(data) {
  return {
    'performance-report.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  // Custom summary formatting
  const indent = options.indent || '';
  const lines = [];

  lines.push(`${indent}Test Summary:`);
  lines.push(`${indent}  Duration: ${data.state.testRunDurationMs}ms`);
  lines.push(`${indent}  VUs: ${data.metrics.vus.values.max}`);
  lines.push(`${indent}  Iterations: ${data.metrics.iterations.values.count}`);
  lines.push('');
  lines.push(`${indent}Performance Metrics:`);
  lines.push(`${indent}  Analytics p95: ${data.metrics.analytics_latency.values['p(95)']}ms`);
  lines.push(
    `${indent}  User Breakdown p95: ${data.metrics.user_breakdown_latency.values['p(95)']}ms`,
  );
  lines.push(
    `${indent}  Model Breakdown p95: ${data.metrics.model_breakdown_latency.values['p(95)']}ms`,
  );
  lines.push(`${indent}  Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%`);

  return lines.join('\n');
}
```

**Create Stress Test Script**:

**File**: `backend/tests/performance/stress-test-analytics.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  stages: [
    // Gradually ramp up to breaking point
    { duration: '2m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 400 },
    { duration: '2m', target: 500 },
    // Hold at max for 5 minutes
    { duration: '5m', target: 500 },
    // Ramp down
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    // We expect this to fail - we're finding the breaking point
    errors: ['rate<0.5'], // Allow up to 50% errors in stress test
    latency: ['p(95)<5000'], // Allow up to 5s latency
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';
const API_TOKEN = __ENV.API_TOKEN || 'test-token';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_TOKEN}`,
  };

  const filters = {
    startDate: '2024-01-01',
    endDate: '2024-03-31',
  };

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/v1/admin/usage/analytics`, JSON.stringify(filters), {
    headers,
    timeout: '30s',
  });
  latency.add(Date.now() - start);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  if (!success) {
    errorRate.add(1);
  }

  sleep(0.5); // Minimal sleep to maximize load
}

export function handleSummary(data) {
  const breakingPoint = findBreakingPoint(data);

  console.log(`\n=== Stress Test Summary ===`);
  console.log(`Breaking Point: ~${breakingPoint} VUs`);
  console.log(`Max Successful VUs: ${data.metrics.vus.values.max}`);
  console.log(`Total Errors: ${data.metrics.errors.values.count}`);
  console.log(`Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%`);
  console.log(`p95 Latency: ${data.metrics.latency.values['p(95)']}ms`);
  console.log(`p99 Latency: ${data.metrics.latency.values['p(99)']}ms`);

  return {
    'stress-test-report.json': JSON.stringify(
      {
        breakingPoint,
        maxVUs: data.metrics.vus.values.max,
        errorRate: data.metrics.errors.values.rate,
        latency: {
          p50: data.metrics.latency.values['p(50)'],
          p95: data.metrics.latency.values['p(95)'],
          p99: data.metrics.latency.values['p(99)'],
        },
      },
      null,
      2,
    ),
  };
}

function findBreakingPoint(data) {
  // Simplified breaking point detection
  // In practice, analyze error rate over time
  if (data.metrics.errors.values.rate > 0.1) {
    return Math.floor(data.metrics.vus.values.max * 0.8);
  }
  return data.metrics.vus.values.max;
}
```

---

### Step 5B.3: Run Performance Tests (2-3 hours)

#### Objectives

- Execute load tests against staging environment
- Execute stress tests to find breaking points
- Collect and analyze results

#### Implementation

**Run Load Test**:

```bash
# Set environment variables
export BASE_URL="http://staging.example.com"
export API_TOKEN="your-admin-token"

# Run load test
k6 run backend/tests/performance/load-test-analytics.js

# Expected output:
# ✓ analytics status is 200
# ✓ analytics has data
# ✓ user breakdown status is 200
# ...
# analytics_latency............: avg=342ms min=156ms med=298ms max=1.2s p(90)=445ms p(95)=486ms
# user_breakdown_latency.......: avg=687ms min=423ms med=654ms max=1.8s p(90)=891ms p(95)=945ms
# errors.......................: 0.23% ✓ 12 ✗ 5123
# http_req_duration............: avg=412ms min=156ms med=389ms max=1.8s p(90)=678ms p(95)=745ms
```

**Run Stress Test**:

```bash
# Run stress test (this will push system to breaking point)
k6 run backend/tests/performance/stress-test-analytics.js

# Monitor system resources during test:
# - CPU usage
# - Memory usage
# - Database connections
# - Response times
# - Error rates
```

**Analyze Results**:

```markdown
### Load Test Results (50 concurrent users)

**Throughput**:

- Total requests: 5,123
- Requests/second: 85.4
- Duration: 60 seconds

**Latency**:

- Analytics p50: 298ms ✅ (target: <200ms) ⚠️ slightly above
- Analytics p95: 486ms ✅ (target: <500ms)
- Analytics p99: 892ms ✅ (target: <1s)
- User Breakdown p95: 945ms ✅ (target: <1s)

**Reliability**:

- Error rate: 0.23% ✅ (target: <1%)
- Success rate: 99.77%

**Resource Usage**:

- CPU: 45% avg, 78% peak
- Memory: 2.1GB avg, 2.8GB peak
- Database connections: 12 avg, 25 peak

**Verdict**: PASS - System handles target load with acceptable performance

---

### Stress Test Results

**Breaking Point**: ~380 concurrent users

**Symptoms at Breaking Point**:

- Error rate spikes to 15%
- p95 latency exceeds 5 seconds
- Database connection pool exhausted
- CPU at 100%

**Scaling Recommendations**:

- Current capacity: ~300 concurrent users (safe margin)
- To support 500 users: Add 2x backend replicas
- To support 1000 users: Add 3x backend + read replica for database

**Bottleneck Analysis**:

1. Database connections (primary bottleneck)
2. CPU on backend server (secondary bottleneck)
3. JSONB aggregation queries (optimization opportunity)
```

---

### Step 5B.4: Create Performance Benchmarks (1 hour)

#### Objectives

- Document baseline performance metrics
- Create automated benchmark tests
- Establish performance SLAs

#### Implementation

**Create Benchmark Documentation**:

**File**: `docs/operations/performance-benchmarks.md`

```markdown
# Admin Analytics Performance Benchmarks

**Last Updated**: 2025-10-11
**Test Environment**: Staging (4 vCPU, 8GB RAM, PostgreSQL 14)
**Test Dataset**: 10,000 users, 365 days, 1M+ requests

---

## Performance SLAs

### Response Time Targets

| Endpoint                 | p50     | p95     | p99   | Max Acceptable |
| ------------------------ | ------- | ------- | ----- | -------------- |
| POST /analytics          | < 200ms | < 500ms | < 1s  | 2s             |
| POST /user-breakdown     | < 500ms | < 1s    | < 2s  | 5s             |
| POST /model-breakdown    | < 500ms | < 1s    | < 2s  | 5s             |
| POST /provider-breakdown | < 500ms | < 1s    | < 2s  | 5s             |
| POST /refresh-today      | < 2s    | < 5s    | < 10s | 30s            |
| POST /rebuild-cache      | < 2m    | < 5m    | < 10m | 30m            |

### Throughput Targets

- **Normal Load**: 50 requests/second sustained
- **Peak Load**: 100 requests/second burst for 1 minute
- **Maximum Capacity**: 300 concurrent users

### Reliability Targets

- **Uptime**: 99.9% (excluding planned maintenance)
- **Error Rate**: < 0.1% under normal load
- **Error Rate**: < 1% under peak load

---

## Baseline Performance Metrics

### Test Configuration

- **Virtual Users**: 50 concurrent
- **Test Duration**: 10 minutes
- **Date Range**: 90 days
- **Total Requests**: 5,123

### Results

**Analytics Endpoint**:
```

avg: 342ms
p50: 298ms ✅
p95: 486ms ✅
p99: 892ms ✅
max: 1.2s

```

**User Breakdown Endpoint**:
```

avg: 687ms
p50: 654ms ✅
p95: 945ms ✅
p99: 1.4s ✅
max: 1.8s

```

**System Resources**:
```

CPU: 45% avg, 78% peak
Memory: 2.1GB avg, 2.8GB peak
DB Connections: 12 avg, 25 peak

````

---

## Scaling Guidelines

### Current Capacity

- **Safe Capacity**: 50 concurrent users, 85 req/s
- **Maximum Capacity**: 300 concurrent users (with degraded performance)
- **Breaking Point**: 380 concurrent users (15% error rate)

### Scaling Recommendations

**To support 100 concurrent users**:
- Add 1 backend replica (2 total)
- No database changes needed

**To support 500 concurrent users**:
- Add 2 backend replicas (3 total)
- Add PostgreSQL read replica
- Consider Redis cache layer

**To support 1000+ concurrent users**:
- Add 4+ backend replicas (5+ total)
- Add PostgreSQL read replicas (2+ replicas)
- Implement Redis cache layer
- Consider CDN for static data

---

## Performance Regression Testing

### CI/CD Integration

Run automated performance tests on every release:

```yaml
# .github/workflows/performance-test.yml
name: Performance Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run k6 load test
        run: |
          k6 run backend/tests/performance/load-test-analytics.js \
            --out json=results.json
      - name: Check thresholds
        run: |
          # Fail if p95 > 500ms
          jq '.metrics.analytics_latency.values["p(95)"] < 500' results.json
````

### Performance Alert Thresholds

**Warning**: If metrics exceed baseline by 20%
**Critical**: If metrics exceed baseline by 50%

Monitor:

- p95 latency > 600ms (baseline: 486ms)
- Error rate > 0.5% (baseline: 0.23%)
- Throughput < 70 req/s (baseline: 85 req/s)

---

## Historical Performance Data

### v1.0.0 (2025-01-15)

- Analytics p95: 486ms
- User breakdown p95: 945ms
- Throughput: 85 req/s

### v1.1.0 (2025-02-15) - After DB Optimization

- Analytics p95: 342ms (30% improvement)
- User breakdown p95: 687ms (27% improvement)
- Throughput: 112 req/s (32% improvement)

### v1.2.0 (TBD) - After Redis Cache

- Target analytics p95: <200ms
- Target user breakdown p95: <500ms
- Target throughput: 200+ req/s

````

---

### Step 5B.5: Integrate with CI/CD (1 hour)

#### Objectives

- Add performance tests to CI/CD pipeline
- Configure performance budgets
- Set up automated alerts

#### Implementation

**Create GitHub Actions Workflow**:

**File**: `.github/workflows/performance-test.yml`

```yaml
name: Performance Test

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  performance-test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_USER: litemaas
          POSTGRES_PASSWORD: test
          POSTGRES_DB: litemaas_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        run: |
          npm --prefix backend run migrate
          npm --prefix backend run test:perf:setup
        env:
          DATABASE_URL: postgresql://litemaas:test@localhost:5432/litemaas_test

      - name: Start backend server
        run: |
          npm --prefix backend run start &
          sleep 10
        env:
          DATABASE_URL: postgresql://litemaas:test@localhost:5432/litemaas_test
          PORT: 8081

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run load test
        run: |
          k6 run backend/tests/performance/load-test-analytics.js \
            --out json=performance-results.json
        env:
          BASE_URL: http://localhost:8081
          API_TOKEN: ${{ secrets.TEST_API_TOKEN }}

      - name: Analyze results
        run: |
          node backend/tests/performance/analyze-results.js performance-results.json

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: |
            performance-results.json
            performance-report.json

      - name: Check performance budgets
        run: |
          # Fail if p95 > 500ms
          ANALYTICS_P95=$(jq '.metrics.analytics_latency.values["p(95)"]' performance-results.json)
          if (( $(echo "$ANALYTICS_P95 > 500" | bc -l) )); then
            echo "Performance budget exceeded: analytics p95 = ${ANALYTICS_P95}ms (budget: 500ms)"
            exit 1
          fi

          # Fail if error rate > 1%
          ERROR_RATE=$(jq '.metrics.errors.values.rate' performance-results.json)
          if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
            echo "Error rate budget exceeded: ${ERROR_RATE} (budget: 0.01)"
            exit 1
          fi

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('performance-results.json', 'utf8'));

            const comment = `
            ## Performance Test Results

            **Analytics Endpoint**:
            - p50: ${results.metrics.analytics_latency.values['p(50)']}ms
            - p95: ${results.metrics.analytics_latency.values['p(95)']}ms
            - p99: ${results.metrics.analytics_latency.values['p(99)']}ms

            **User Breakdown Endpoint**:
            - p95: ${results.metrics.user_breakdown_latency.values['p(95)']}ms

            **Error Rate**: ${(results.metrics.errors.values.rate * 100).toFixed(2)}%

            ${results.metrics.analytics_latency.values['p(95)'] < 500 ? '✅ Performance budget met' : '❌ Performance budget exceeded'}
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
````

---

## Session 5B Deliverables

### Performance Test Suite

- [ ] k6 load test scripts created
- [ ] k6 stress test scripts created
- [ ] Test data setup automation
- [ ] Performance benchmark documentation
- [ ] CI/CD integration complete

### Test Results

- [ ] Load test results documented
- [ ] Stress test results documented
- [ ] Breaking point identified
- [ ] Scaling recommendations documented
- [ ] Performance budgets established

### Documentation

- [ ] Performance benchmarks documented
- [ ] Scaling guidelines created
- [ ] CI/CD workflow configured
- [ ] Performance SLAs defined

---

## Acceptance Criteria

### Performance Targets Met

- [ ] Analytics p95 < 500ms
- [ ] User breakdown p95 < 1s
- [ ] Error rate < 1%
- [ ] Throughput > 50 req/s sustained

### Test Coverage

- [ ] Load test covers all endpoints
- [ ] Stress test identifies breaking point
- [ ] Automated tests run in CI/CD
- [ ] Performance budgets enforced

### Documentation

- [ ] Benchmark documentation complete
- [ ] Scaling guidelines documented
- [ ] Historical performance tracked

---

## Validation

### Run Full Performance Test Suite

```bash
# Run load test
k6 run backend/tests/performance/load-test-analytics.js

# Run stress test
k6 run backend/tests/performance/stress-test-analytics.js

# Verify CI/CD integration
git push origin main
# Check GitHub Actions runs successfully
```

### Manual Validation

- [ ] Review performance test results
- [ ] Verify all SLAs met
- [ ] Confirm CI/CD pipeline passes
- [ ] Review scaling recommendations

---

## Next Steps

After completing Session 5B:

1. **Session Validation**: Review all test results
2. **Performance Sign-Off**: Get approval on benchmarks
3. **Deploy to Production**: With monitoring in place
4. **Proceed to Session 5C**: [Monitoring & Metrics](./phase-5-session-5c-monitoring-metrics.md)

---

## Session 5B Notes

**Estimated Time**: 6-8 hours
**Actual Time**: **\_\_\_** hours

**Performance Results**:

- Analytics p95: **\_\_\_**ms
- User breakdown p95: **\_\_\_**ms
- Breaking point: **\_\_\_** VUs

**Bottlenecks Identified**:

- ***

**Scaling Recommendations**:

- ***

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**Status**: Ready for execution
