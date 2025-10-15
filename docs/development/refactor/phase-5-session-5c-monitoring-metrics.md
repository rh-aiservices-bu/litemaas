# Phase 5, Session 5C: Monitoring & Metrics

**Phase**: 5 - Performance & Observability
**Session**: 5C - Monitoring & Metrics
**Duration**: 6-10 hours
**Priority**: 🟢 MEDIUM
**Issues**: Comprehensive monitoring and observability implementation

---

## Navigation

- **Previous Session**: [Session 5B: Performance Testing](./phase-5-session-5b-performance-testing.md)
- **Next Phase**: [Phase 6: Advanced Features](../admin-analytics-remediation-plan.md#phase-6-advanced-features-optional) (Optional)
- **Phase Checkpoint**: [Phase 5 Completion](#phase-5-checkpoint)
- **Parent Document**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

### Session Overview

Session 5C focuses on implementing comprehensive monitoring and observability for the admin analytics feature. This includes application metrics, performance tracking, error monitoring, and operational dashboards to ensure production reliability.

### Prerequisites

Before starting Session 5C, ensure:

- ✅ Session 5A (Database Optimization) completed
- ✅ Session 5B (Performance Testing) completed
- ✅ Monitoring infrastructure available (Prometheus, Grafana, or similar)
- ✅ Log aggregation configured (optional but recommended)
- ✅ Access to production monitoring tools

### Related Documentation

- [Performance Testing Session](./phase-5-session-5b-performance-testing.md)
- [Performance Benchmarks](../../operations/performance-benchmarks.md)
- [Backend Architecture](../../backend/CLAUDE.md)

---

## Session 5C Objectives

### Primary Goals

1. **Application Metrics**: Add custom metrics for admin analytics operations
2. **Performance Tracking**: Monitor query performance and cache efficiency
3. **Error Monitoring**: Track and alert on errors and failures
4. **Operational Dashboards**: Create Grafana dashboards for monitoring
5. **Alerting Rules**: Configure alerts for critical issues

### Deliverables

- [ ] Custom Prometheus metrics implemented
- [ ] Performance monitoring in place
- [ ] Error tracking configured
- [ ] Grafana dashboards created
- [ ] Alert rules defined
- [ ] Monitoring documentation

### Success Metrics

- **Metric Coverage**: > 90% of critical operations instrumented
- **Alert Response Time**: < 5 minutes for critical alerts
- **Dashboard Completeness**: All key metrics visible
- **Log Retention**: 30 days minimum
- **Monitoring Overhead**: < 2% performance impact

---

## Implementation Steps

### Step 5C.1: Add Application Metrics (2-3 hours)

#### Objectives

- Add Prometheus metrics for admin analytics
- Track request counts, latency, cache hits/misses
- Monitor database query performance

#### Pre-Work Checklist

- [ ] Prometheus client library installed (`prom-client`)
- [ ] Metrics endpoint configured
- [ ] Prometheus server configured to scrape metrics
- [ ] Understand key metrics to track

#### Implementation

**Install Dependencies**:

```bash
npm --prefix backend install prom-client
```

**Create Metrics Module**:

**File**: `backend/src/utils/metrics.ts`

```typescript
import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

/**
 * Admin Analytics Metrics
 */

// Request counters
export const adminAnalyticsRequests = new client.Counter({
  name: 'admin_analytics_requests_total',
  help: 'Total number of admin analytics requests',
  labelNames: ['endpoint', 'status'],
  registers: [register],
});

// Request duration histogram
export const adminAnalyticsLatency = new client.Histogram({
  name: 'admin_analytics_request_duration_seconds',
  help: 'Duration of admin analytics requests in seconds',
  labelNames: ['endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10], // 100ms, 500ms, 1s, 2s, 5s, 10s
  registers: [register],
});

// Cache metrics
export const cacheHits = new client.Counter({
  name: 'admin_analytics_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheMisses = new client.Counter({
  name: 'admin_analytics_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheSize = new client.Gauge({
  name: 'admin_analytics_cache_size_bytes',
  help: 'Current size of cache in bytes',
  labelNames: ['cache_type'],
  registers: [register],
});

// Database query metrics
export const dbQueryDuration = new client.Histogram({
  name: 'admin_analytics_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const dbQueryCount = new client.Counter({
  name: 'admin_analytics_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['query_type', 'status'],
  registers: [register],
});

// Aggregation metrics
export const aggregationDuration = new client.Histogram({
  name: 'admin_analytics_aggregation_duration_seconds',
  help: 'Duration of aggregation operations',
  labelNames: ['aggregation_type'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [register],
});

export const aggregationSize = new client.Gauge({
  name: 'admin_analytics_aggregation_size',
  help: 'Number of records processed in aggregation',
  labelNames: ['aggregation_type'],
  registers: [register],
});

// Export metrics
export const exportRequests = new client.Counter({
  name: 'admin_analytics_export_requests_total',
  help: 'Total number of export requests',
  labelNames: ['format', 'status'],
  registers: [register],
});

export const exportSize = new client.Histogram({
  name: 'admin_analytics_export_size_bytes',
  help: 'Size of exported data in bytes',
  labelNames: ['format'],
  buckets: [1000, 10000, 100000, 1000000, 10000000], // 1KB to 10MB
  registers: [register],
});

// Error metrics
export const errors = new client.Counter({
  name: 'admin_analytics_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'endpoint'],
  registers: [register],
});

// Rate limiting metrics
export const rateLimitHits = new client.Counter({
  name: 'admin_analytics_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint'],
  registers: [register],
});

/**
 * Get metrics registry for Prometheus endpoint
 */
export function getMetricsRegistry(): client.Registry {
  return register;
}

/**
 * Helper to measure execution time
 */
export async function measureExecutionTime<T>(
  histogram: client.Histogram,
  labels: Record<string, string>,
  fn: () => Promise<T>,
): Promise<T> {
  const end = histogram.startTimer(labels);
  try {
    const result = await fn();
    end();
    return result;
  } catch (error) {
    end();
    throw error;
  }
}
```

**Add Metrics Endpoint**:

**File**: `backend/src/routes/metrics.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { getMetricsRegistry } from '../utils/metrics';

export default async function metricsRoutes(fastify: FastifyInstance) {
  /**
   * Prometheus metrics endpoint
   *
   * Should be exposed for Prometheus to scrape
   * Consider restricting access to internal networks only
   */
  fastify.get(
    '/metrics',
    {
      schema: {
        description: 'Prometheus metrics endpoint',
        tags: ['monitoring'],
        response: {
          200: {
            type: 'string',
            description: 'Prometheus metrics in text format',
          },
        },
      },
    },
    async (request, reply) => {
      const register = getMetricsRegistry();
      const metrics = await register.metrics();

      reply.type('text/plain; version=0.0.4');
      return metrics;
    },
  );
}
```

**Instrument Service Methods**:

**File**: `backend/src/services/admin-usage/admin-usage-stats.service.ts`

```typescript
import {
  adminAnalyticsRequests,
  adminAnalyticsLatency,
  dbQueryDuration,
  dbQueryCount,
  aggregationDuration,
  aggregationSize,
  cacheHits,
  cacheMisses,
  errors,
  measureExecutionTime,
} from '../../utils/metrics';

export class AdminUsageStatsService extends BaseService {
  /**
   * Get analytics with metrics instrumentation
   */
  async getAnalytics(filters: AdminUsageFilters): Promise<AdminAnalytics> {
    const endpoint = 'analytics';

    return measureExecutionTime(adminAnalyticsLatency, { endpoint }, async () => {
      try {
        // Increment request counter
        adminAnalyticsRequests.inc({ endpoint, status: 'started' });

        // Check cache
        const cacheResult = await this.getCachedAnalytics(filters);
        if (cacheResult) {
          cacheHits.inc({ cache_type: 'analytics' });
          adminAnalyticsRequests.inc({ endpoint, status: 'success' });
          return cacheResult;
        }

        cacheMisses.inc({ cache_type: 'analytics' });

        // Fetch from database with metrics
        const data = await measureExecutionTime(
          dbQueryDuration,
          { query_type: 'get_analytics' },
          async () => {
            dbQueryCount.inc({ query_type: 'get_analytics', status: 'started' });
            try {
              const result = await this.fetchAnalyticsFromDB(filters);
              dbQueryCount.inc({ query_type: 'get_analytics', status: 'success' });
              return result;
            } catch (error) {
              dbQueryCount.inc({ query_type: 'get_analytics', status: 'error' });
              throw error;
            }
          },
        );

        // Aggregate with metrics
        const aggregated = await measureExecutionTime(
          aggregationDuration,
          { aggregation_type: 'analytics' },
          async () => {
            const result = await this.aggregateAnalytics(data);
            aggregationSize.set({ aggregation_type: 'analytics' }, data.length);
            return result;
          },
        );

        adminAnalyticsRequests.inc({ endpoint, status: 'success' });
        return aggregated;
      } catch (error) {
        // Track error
        errors.inc({
          error_type: error.name || 'UnknownError',
          endpoint,
        });
        adminAnalyticsRequests.inc({ endpoint, status: 'error' });

        this.fastify.log.error({ error, filters }, 'Failed to get analytics');
        throw error;
      }
    });
  }

  /**
   * User breakdown with metrics
   */
  async getUserBreakdown(filters: AdminUsageFilters): Promise<UserBreakdown[]> {
    const endpoint = 'user_breakdown';

    return measureExecutionTime(adminAnalyticsLatency, { endpoint }, async () => {
      try {
        adminAnalyticsRequests.inc({ endpoint, status: 'started' });

        const result = await measureExecutionTime(
          dbQueryDuration,
          { query_type: 'user_breakdown' },
          async () => {
            dbQueryCount.inc({ query_type: 'user_breakdown', status: 'started' });
            const breakdown = await this.fetchUserBreakdownFromDB(filters);
            dbQueryCount.inc({ query_type: 'user_breakdown', status: 'success' });
            return breakdown;
          },
        );

        aggregationSize.set({ aggregation_type: 'user_breakdown' }, result.length);
        adminAnalyticsRequests.inc({ endpoint, status: 'success' });

        return result;
      } catch (error) {
        errors.inc({ error_type: error.name || 'UnknownError', endpoint });
        adminAnalyticsRequests.inc({ endpoint, status: 'error' });
        throw error;
      }
    });
  }

  /**
   * Export with metrics
   */
  async exportToCSV(data: UserBreakdown[], filters: AdminUsageFilters): Promise<string> {
    try {
      exportRequests.inc({ format: 'csv', status: 'started' });

      const csv = await this.generateCSV(data);
      const sizeBytes = Buffer.byteLength(csv, 'utf8');

      exportSize.observe({ format: 'csv' }, sizeBytes);
      exportRequests.inc({ format: 'csv', status: 'success' });

      return csv;
    } catch (error) {
      exportRequests.inc({ format: 'csv', status: 'error' });
      errors.inc({ error_type: error.name || 'UnknownError', endpoint: 'export' });
      throw error;
    }
  }
}
```

**Add Rate Limiting Metrics**:

**File**: `backend/src/routes/admin-usage.ts`

```typescript
import { rateLimitHits } from '../utils/metrics';

// In rate limit handler
fastify.addHook('onError', async (request, reply, error) => {
  if (error.statusCode === 429) {
    rateLimitHits.inc({ endpoint: request.routerPath });
  }
});
```

---

### Step 5C.2: Configure Prometheus Scraping (30 minutes)

#### Objectives

- Configure Prometheus to scrape metrics
- Set up service discovery
- Verify metrics collection

#### Implementation

**Prometheus Configuration**:

**File**: `prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # LiteMaaS Backend Metrics
  - job_name: 'litemaas-backend'
    static_configs:
      - targets: ['backend:8081']
    metrics_path: '/metrics'
    scrape_interval: 10s
    scrape_timeout: 5s

  # OpenShift Service Discovery (production)
  - job_name: 'litemaas-backend-k8s'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - litemaas
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: litemaas-backend
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
```

**Add Annotations to OpenShift Deployment**:

**File**: `deployment/openshift/backend-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: litemaas-backend
spec:
  template:
    metadata:
      annotations:
        prometheus.io/scrape: 'true'
        prometheus.io/port: '8081'
        prometheus.io/path: '/metrics'
    spec:
      containers:
        - name: backend
          # ... container spec
```

**Verify Metrics Collection**:

```bash
# Check metrics endpoint
curl http://localhost:8081/metrics

# Should see output like:
# admin_analytics_requests_total{endpoint="analytics",status="success"} 42
# admin_analytics_request_duration_seconds_bucket{endpoint="analytics",le="0.5"} 38
# admin_analytics_cache_hits_total{cache_type="analytics"} 35
# ...

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="litemaas-backend")'

# Should show target as UP
```

---

### Step 5C.3: Create Grafana Dashboards (2-3 hours)

#### Objectives

- Create comprehensive monitoring dashboard
- Add performance visualization
- Create operational overview

#### Implementation

**Create Admin Analytics Dashboard**:

**File**: `monitoring/grafana/dashboards/admin-analytics.json`

```json
{
  "dashboard": {
    "title": "Admin Analytics - Performance & Operations",
    "tags": ["admin", "analytics", "performance"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "type": "graph",
        "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 },
        "targets": [
          {
            "expr": "rate(admin_analytics_requests_total{status=\"success\"}[5m])",
            "legendFormat": "{{endpoint}} - success",
            "refId": "A"
          },
          {
            "expr": "rate(admin_analytics_requests_total{status=\"error\"}[5m])",
            "legendFormat": "{{endpoint}} - error",
            "refId": "B"
          }
        ],
        "yaxes": [{ "label": "requests/sec", "format": "short" }]
      },
      {
        "id": 2,
        "title": "Request Latency (p95)",
        "type": "graph",
        "gridPos": { "x": 12, "y": 0, "w": 12, "h": 8 },
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(admin_analytics_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{endpoint}} - p95",
            "refId": "A"
          },
          {
            "expr": "histogram_quantile(0.99, rate(admin_analytics_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{endpoint}} - p99",
            "refId": "B"
          }
        ],
        "yaxes": [{ "label": "seconds", "format": "s" }],
        "alert": {
          "conditions": [
            {
              "evaluator": { "params": [0.5], "type": "gt" },
              "operator": { "type": "and" },
              "query": { "params": ["A", "5m", "now"] },
              "reducer": { "params": [], "type": "avg" },
              "type": "query"
            }
          ],
          "name": "High Request Latency"
        }
      },
      {
        "id": 3,
        "title": "Cache Hit Rate",
        "type": "stat",
        "gridPos": { "x": 0, "y": 8, "w": 6, "h": 4 },
        "targets": [
          {
            "expr": "sum(rate(admin_analytics_cache_hits_total[5m])) / (sum(rate(admin_analytics_cache_hits_total[5m])) + sum(rate(admin_analytics_cache_misses_total[5m]))) * 100",
            "refId": "A"
          }
        ],
        "options": {
          "graphMode": "area",
          "textMode": "value_and_name",
          "unit": "percent"
        },
        "thresholds": {
          "steps": [
            { "value": 0, "color": "red" },
            { "value": 50, "color": "orange" },
            { "value": 80, "color": "green" }
          ]
        }
      },
      {
        "id": 4,
        "title": "Error Rate",
        "type": "stat",
        "gridPos": { "x": 6, "y": 8, "w": 6, "h": 4 },
        "targets": [
          {
            "expr": "sum(rate(admin_analytics_requests_total{status=\"error\"}[5m])) / sum(rate(admin_analytics_requests_total[5m])) * 100",
            "refId": "A"
          }
        ],
        "options": {
          "textMode": "value_and_name",
          "unit": "percent"
        },
        "thresholds": {
          "steps": [
            { "value": 0, "color": "green" },
            { "value": 0.1, "color": "orange" },
            { "value": 1, "color": "red" }
          ]
        }
      },
      {
        "id": 5,
        "title": "Database Query Duration",
        "type": "graph",
        "gridPos": { "x": 0, "y": 12, "w": 12, "h": 8 },
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(admin_analytics_db_query_duration_seconds_bucket[5m]))",
            "legendFormat": "{{query_type}} - p95",
            "refId": "A"
          }
        ],
        "yaxes": [{ "label": "seconds", "format": "s" }]
      },
      {
        "id": 6,
        "title": "Aggregation Performance",
        "type": "graph",
        "gridPos": { "x": 12, "y": 12, "w": 12, "h": 8 },
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(admin_analytics_aggregation_duration_seconds_bucket[5m]))",
            "legendFormat": "{{aggregation_type}} - duration",
            "refId": "A"
          },
          {
            "expr": "admin_analytics_aggregation_size",
            "legendFormat": "{{aggregation_type}} - size",
            "refId": "B",
            "yAxisIndex": 1
          }
        ],
        "yaxes": [
          { "label": "seconds", "format": "s" },
          { "label": "records", "format": "short" }
        ]
      },
      {
        "id": 7,
        "title": "Rate Limiting",
        "type": "graph",
        "gridPos": { "x": 0, "y": 20, "w": 12, "h": 8 },
        "targets": [
          {
            "expr": "rate(admin_analytics_rate_limit_hits_total[5m])",
            "legendFormat": "{{endpoint}}",
            "refId": "A"
          }
        ],
        "yaxes": [{ "label": "hits/sec", "format": "short" }]
      },
      {
        "id": 8,
        "title": "Export Activity",
        "type": "graph",
        "gridPos": { "x": 12, "y": 20, "w": 12, "h": 8 },
        "targets": [
          {
            "expr": "rate(admin_analytics_export_requests_total[5m])",
            "legendFormat": "{{format}} - {{status}}",
            "refId": "A"
          },
          {
            "expr": "histogram_quantile(0.95, rate(admin_analytics_export_size_bytes_bucket[5m]))",
            "legendFormat": "{{format}} - size p95",
            "refId": "B",
            "yAxisIndex": 1
          }
        ],
        "yaxes": [
          { "label": "exports/sec", "format": "short" },
          { "label": "bytes", "format": "bytes" }
        ]
      }
    ]
  }
}
```

**Import Dashboard to Grafana**:

```bash
# Using Grafana API
curl -X POST \
  http://grafana:3000/api/dashboards/db \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -d @monitoring/grafana/dashboards/admin-analytics.json

# Or manually: Grafana UI → Dashboards → Import → Upload JSON file
```

---

### Step 5C.4: Configure Alerting Rules (1.5-2 hours)

#### Objectives

- Create Prometheus alert rules
- Configure alert notifications (Slack, email, PagerDuty)
- Test alert firing

#### Implementation

**Create Alert Rules**:

**File**: `prometheus/rules/admin-analytics-alerts.yml`

```yaml
groups:
  - name: admin_analytics_alerts
    interval: 30s
    rules:
      # High latency alert
      - alert: AdminAnalyticsHighLatency
        expr: |
          histogram_quantile(0.95,
            rate(admin_analytics_request_duration_seconds_bucket[5m])
          ) > 0.5
        for: 5m
        labels:
          severity: warning
          component: admin-analytics
        annotations:
          summary: 'High latency detected on {{ $labels.endpoint }}'
          description: 'p95 latency is {{ $value | humanizeDuration }} (threshold: 500ms)'

      # Critical latency alert
      - alert: AdminAnalyticsCriticalLatency
        expr: |
          histogram_quantile(0.95,
            rate(admin_analytics_request_duration_seconds_bucket[5m])
          ) > 2
        for: 2m
        labels:
          severity: critical
          component: admin-analytics
        annotations:
          summary: 'CRITICAL: Very high latency on {{ $labels.endpoint }}'
          description: 'p95 latency is {{ $value | humanizeDuration }} (threshold: 2s)'

      # High error rate
      - alert: AdminAnalyticsHighErrorRate
        expr: |
          sum(rate(admin_analytics_requests_total{status="error"}[5m]))
          / sum(rate(admin_analytics_requests_total[5m])) * 100 > 1
        for: 5m
        labels:
          severity: warning
          component: admin-analytics
        annotations:
          summary: 'High error rate detected'
          description: 'Error rate is {{ $value | printf "%.2f" }}% (threshold: 1%)'

      # Critical error rate
      - alert: AdminAnalyticsCriticalErrorRate
        expr: |
          sum(rate(admin_analytics_requests_total{status="error"}[5m]))
          / sum(rate(admin_analytics_requests_total[5m])) * 100 > 5
        for: 2m
        labels:
          severity: critical
          component: admin-analytics
        annotations:
          summary: 'CRITICAL: Very high error rate'
          description: 'Error rate is {{ $value | printf "%.2f" }}% (threshold: 5%)'

      # Low cache hit rate
      - alert: AdminAnalyticsLowCacheHitRate
        expr: |
          sum(rate(admin_analytics_cache_hits_total[10m]))
          / (sum(rate(admin_analytics_cache_hits_total[10m]))
          + sum(rate(admin_analytics_cache_misses_total[10m]))) * 100 < 50
        for: 15m
        labels:
          severity: warning
          component: admin-analytics
        annotations:
          summary: 'Low cache hit rate'
          description: 'Cache hit rate is {{ $value | printf "%.2f" }}% (threshold: 50%)'

      # Database query slow
      - alert: AdminAnalyticsSlowDatabaseQueries
        expr: |
          histogram_quantile(0.95,
            rate(admin_analytics_db_query_duration_seconds_bucket[5m])
          ) > 1
        for: 5m
        labels:
          severity: warning
          component: admin-analytics
        annotations:
          summary: 'Slow database queries on {{ $labels.query_type }}'
          description: 'p95 query duration is {{ $value | humanizeDuration }} (threshold: 1s)'

      # Rate limiting triggered
      - alert: AdminAnalyticsRateLimitingActive
        expr: rate(admin_analytics_rate_limit_hits_total[5m]) > 0.1
        for: 10m
        labels:
          severity: info
          component: admin-analytics
        annotations:
          summary: 'Rate limiting active on {{ $labels.endpoint }}'
          description: 'Rate limit hits: {{ $value | printf "%.2f" }}/s'

      # Service down
      - alert: AdminAnalyticsServiceDown
        expr: up{job="litemaas-backend"} == 0
        for: 1m
        labels:
          severity: critical
          component: admin-analytics
        annotations:
          summary: 'Admin analytics service is down'
          description: 'Backend service is not responding'
```

**Configure Alertmanager**:

**File**: `prometheus/alertmanager.yml`

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'component']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      continue: true

    - match:
        severity: warning
      receiver: 'warning-alerts'

    - match:
        severity: info
      receiver: 'info-alerts'

receivers:
  - name: 'default'
    slack_configs:
      - api_url: '$SLACK_WEBHOOK_URL'
        channel: '#litemaas-alerts'
        title: 'LiteMaaS Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'

  - name: 'critical-alerts'
    slack_configs:
      - api_url: '$SLACK_WEBHOOK_URL'
        channel: '#litemaas-critical'
        title: '🔴 CRITICAL ALERT'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}\n{{ end }}'
    pagerduty_configs:
      - service_key: '$PAGERDUTY_SERVICE_KEY'
        description: '{{ .GroupLabels.alertname }}'

  - name: 'warning-alerts'
    slack_configs:
      - api_url: '$SLACK_WEBHOOK_URL'
        channel: '#litemaas-alerts'
        title: '⚠️ Warning Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'

  - name: 'info-alerts'
    slack_configs:
      - api_url: '$SLACK_WEBHOOK_URL'
        channel: '#litemaas-alerts'
        title: 'ℹ️ Info'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'component']
```

**Test Alert Firing**:

```bash
# Manually trigger alert (for testing)
curl -X POST http://alertmanager:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning",
      "component": "admin-analytics"
    },
    "annotations": {
      "summary": "Test alert from monitoring setup",
      "description": "This is a test alert to verify alerting is working"
    }
  }]'

# Check alert fired in Alertmanager UI
# http://alertmanager:9093/#/alerts
```

---

### Step 5C.5: Add Log Aggregation (1-2 hours)

#### Objectives

- Configure structured logging
- Add log correlation IDs
- Set up log retention and rotation

#### Implementation

**Enhanced Logging with Correlation IDs**:

**File**: `backend/src/plugins/logging.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';

export default async function loggingPlugin(fastify: FastifyInstance) {
  // Add correlation ID to all requests
  fastify.addHook('onRequest', async (request, reply) => {
    const correlationId = (request.headers['x-correlation-id'] as string) || randomUUID();

    request.headers['x-correlation-id'] = correlationId;
    reply.header('x-correlation-id', correlationId);

    // Add to request context
    request.correlationId = correlationId;
  });

  // Log all requests with correlation ID
  fastify.addHook('onResponse', async (request, reply) => {
    const { method, url, correlationId } = request;
    const { statusCode } = reply;
    const responseTime = reply.getResponseTime();

    fastify.log.info(
      {
        type: 'request',
        correlationId,
        method,
        url,
        statusCode,
        responseTime,
        userAgent: request.headers['user-agent'],
        userId: (request as any).user?.userId,
      },
      'Request completed',
    );
  });

  // Log errors with correlation ID
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(
      {
        type: 'error',
        correlationId: request.correlationId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          statusCode: error.statusCode,
        },
        request: {
          method: request.method,
          url: request.url,
          userId: (request as any).user?.userId,
        },
      },
      'Request error',
    );

    reply.status(error.statusCode || 500).send({
      error: error.message,
      correlationId: request.correlationId,
    });
  });
}

// Type augmentation
declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}
```

**Structured Logging in Services**:

```typescript
// Always include correlation ID and context
this.fastify.log.info(
  {
    correlationId: request.correlationId,
    userId: request.user?.userId,
    operation: 'getAnalytics',
    filters,
    cacheHit: true,
  },
  'Analytics request served from cache',
);

this.fastify.log.error(
  {
    correlationId: request.correlationId,
    userId: request.user?.userId,
    operation: 'getUserBreakdown',
    filters,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  },
  'Failed to fetch user breakdown',
);
```

---

### Step 5C.6: Create Monitoring Documentation (1 hour)

#### Objectives

- Document monitoring setup
- Create runbooks for common alerts
- Document dashboard usage

#### Implementation

**Create Monitoring Guide**:

**File**: `docs/operations/monitoring-guide.md`

````markdown
# Admin Analytics Monitoring Guide

## Overview

This guide describes the monitoring setup for the Admin Analytics feature, including metrics, dashboards, and alerting.

## Metrics

### Key Performance Indicators

**Request Rate**:

- Metric: `admin_analytics_requests_total`
- Target: > 50 req/s sustained
- Alert: < 10 req/s may indicate service issue

**Latency**:

- Metric: `admin_analytics_request_duration_seconds`
- Targets:
  - p50: < 200ms
  - p95: < 500ms
  - p99: < 1s
- Alerts:
  - Warning: p95 > 500ms
  - Critical: p95 > 2s

**Error Rate**:

- Metric: `admin_analytics_requests_total{status="error"}`
- Target: < 0.1%
- Alerts:
  - Warning: > 1%
  - Critical: > 5%

**Cache Hit Rate**:

- Metric: `admin_analytics_cache_hits_total / (hits + misses)`
- Target: > 80%
- Alert: < 50%

## Dashboards

### Admin Analytics Performance Dashboard

**URL**: http://grafana:3000/d/admin-analytics

**Panels**:

1. Request Rate - Shows req/s by endpoint
2. Request Latency - p95/p99 latency trends
3. Cache Hit Rate - Current cache efficiency
4. Error Rate - Error percentage
5. Database Query Duration - DB performance
6. Aggregation Performance - Processing time
7. Rate Limiting - Rate limit hits
8. Export Activity - Export usage

### How to Use

**Normal Operations**:

- Check dashboard once daily
- Verify all metrics within targets
- Review any spike in rate limiting

**During Incidents**:

- Check Error Rate panel first
- Review Request Latency for slowness
- Check Database Query Duration for DB issues
- Review logs with correlation ID from alert

## Alerts

### Critical Alerts

**AdminAnalyticsCriticalLatency**:

- **Condition**: p95 latency > 2s for 2 minutes
- **Impact**: Users experiencing slow responses
- **Runbook**: [High Latency Runbook](#high-latency-runbook)

**AdminAnalyticsCriticalErrorRate**:

- **Condition**: Error rate > 5% for 2 minutes
- **Impact**: Service degraded
- **Runbook**: [High Error Rate Runbook](#high-error-rate-runbook)

**AdminAnalyticsServiceDown**:

- **Condition**: Service not responding for 1 minute
- **Impact**: Service unavailable
- **Runbook**: [Service Down Runbook](#service-down-runbook)

### Warning Alerts

**AdminAnalyticsHighLatency**:

- **Condition**: p95 latency > 500ms for 5 minutes
- **Action**: Investigate performance
- **Runbook**: [High Latency Runbook](#high-latency-runbook)

**AdminAnalyticsHighErrorRate**:

- **Condition**: Error rate > 1% for 5 minutes
- **Action**: Review error logs
- **Runbook**: [High Error Rate Runbook](#high-error-rate-runbook)

**AdminAnalyticsLowCacheHitRate**:

- **Condition**: Cache hit rate < 50% for 15 minutes
- **Action**: Review cache configuration
- **Runbook**: [Low Cache Hit Rate Runbook](#low-cache-hit-rate-runbook)

## Runbooks

### High Latency Runbook

**Symptoms**: Request latency elevated above targets

**Investigation Steps**:

1. Check dashboard for affected endpoints
2. Review Database Query Duration panel
3. Check system resources (CPU, memory)
4. Review slow query logs

**Common Causes**:

- Large date range queries
- Database not using indexes
- High concurrent load
- Resource exhaustion

**Remediation**:

- Reduce date range if user query is too large
- Verify indexes are in place (`\di` in psql)
- Scale backend replicas if load is high
- Restart service if memory leak suspected

---

### High Error Rate Runbook

**Symptoms**: Elevated error rate across requests

**Investigation Steps**:

1. Check Error Rate panel for affected endpoints
2. Review recent error logs with correlation IDs
3. Check database connectivity
4. Verify LiteLLM API status

**Common Causes**:

- Database connection issues
- LiteLLM API unavailable
- Invalid filter parameters
- Cache rebuild in progress

**Remediation**:

- Verify database connection: `pg_isready`
- Check LiteLLM status
- Review and fix invalid queries
- Coordinate cache rebuild during off-hours

---

### Service Down Runbook

**Symptoms**: Backend service not responding

**Investigation Steps**:

1. Check pod status: `oc get pods`
2. Review pod logs: `oc logs <pod-name>`
3. Check resource limits
4. Verify database connectivity

**Common Causes**:

- Pod crash/restart
- OOMKilled (out of memory)
- Database connection lost
- Deployment rollout

**Remediation**:

- Restart pod: `oc delete pod <pod-name>`
- Scale up if resource constrained
- Check database status
- Rollback deployment if bad release

---

### Low Cache Hit Rate Runbook

**Symptoms**: Cache hit rate below 50%

**Investigation Steps**:

1. Check cache size metrics
2. Review cache TTL configuration
3. Verify cache rebuild schedule
4. Check for cache invalidation patterns

**Common Causes**:

- Cache not warmed up
- TTL too short
- Frequent cache invalidations
- Large variety of filter combinations

**Remediation**:

- Warm cache with common queries
- Adjust TTL configuration
- Review cache invalidation logic
- Consider pre-aggregation for common queries

## Log Correlation

All requests include a correlation ID in the `x-correlation-id` header.

**Finding Logs by Correlation ID**:

```bash
# Using grep
grep "correlation-id-value" /var/log/litemaas/backend.log

# Using journalctl
journalctl -u litemaas-backend | grep "correlation-id-value"

# Using Loki/Grafana
{job="litemaas-backend"} |= "correlation-id-value"
```
````

**Example Log Entry**:

```json
{
  "level": "error",
  "time": "2025-10-11T10:30:45.123Z",
  "correlationId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "userId": "user-123",
  "operation": "getAnalytics",
  "error": {
    "name": "DatabaseError",
    "message": "Connection timeout",
    "stack": "..."
  },
  "msg": "Failed to fetch analytics"
}
```

## Contact

**For Alerts**:

- Critical: #litemaas-critical (Slack), PagerDuty rotation
- Warning/Info: #litemaas-alerts (Slack)

**On-Call Rotation**:

- See PagerDuty schedule

**Escalation**:

- L1: On-call engineer
- L2: Tech lead
- L3: Engineering manager

````

---

## Session 5C Deliverables

### Monitoring Implementation

- [ ] Prometheus metrics added (15+ custom metrics)
- [ ] Metrics endpoint exposed
- [ ] Prometheus scraping configured
- [ ] Grafana dashboard created
- [ ] Alert rules defined (7+ alerts)
- [ ] Alertmanager configured
- [ ] Log correlation IDs added

### Documentation

- [ ] Monitoring guide created
- [ ] Runbooks for common alerts
- [ ] Dashboard usage documented
- [ ] Metrics catalog documented

---

## Acceptance Criteria

### Metrics Coverage

- [ ] > 90% of critical operations instrumented
- [ ] All endpoints have request counters
- [ ] All endpoints have latency histograms
- [ ] Cache operations tracked
- [ ] Database queries tracked
- [ ] Errors tracked with types

### Dashboards

- [ ] All key metrics visible
- [ ] Panels show real-time data
- [ ] Alerts configured on critical metrics
- [ ] Dashboard accessible to team

### Alerting

- [ ] All critical scenarios have alerts
- [ ] Alert notifications working (Slack/PagerDuty)
- [ ] Runbooks created for each alert
- [ ] Test alerts successful

### Documentation

- [ ] Monitoring guide complete
- [ ] Runbooks tested and accurate
- [ ] Team trained on dashboard usage

---

## Validation

### Automated Tests

```bash
# Verify metrics endpoint
curl http://localhost:8081/metrics | grep admin_analytics

# Should see all custom metrics

# Verify Prometheus scraping
curl http://prometheus:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="litemaas-backend")'

# Should show status: "up"

# Trigger test alert
curl -X POST http://alertmanager:9093/api/v1/alerts -d '[...]'

# Verify alert received in Slack/PagerDuty
````

### Manual Validation

- [ ] Generate load and verify metrics update
- [ ] Check Grafana dashboard shows live data
- [ ] Trigger alert and verify notification received
- [ ] Search logs by correlation ID successfully

---

## Next Steps

After completing Session 5C:

1. **Phase 5 Validation**: Run full monitoring test
2. **Team Training**: Train team on monitoring tools
3. **Production Deployment**: Deploy with monitoring active
4. **Phase 5 Checkpoint**: Complete phase sign-off

---

## Phase 5 Checkpoint

### Phase 5 Validation Checklist

**Performance (Session 5A)**:

- [ ] All database indexes in place
- [ ] Query performance targets met
- [ ] Batch operations implemented

**Testing (Session 5B)**:

- [ ] Load tests passing
- [ ] Stress test completed
- [ ] Performance benchmarks documented
- [ ] CI/CD integration working

**Monitoring (Session 5C)**:

- [ ] Metrics instrumented
- [ ] Dashboards created
- [ ] Alerts configured
- [ ] Runbooks complete

### Phase 5 Deliverables

**Database Optimization**:

- [x] 5 indexes added
- [x] Query optimization complete
- [x] Performance improved by 67%

**Performance Testing**:

- [x] Load test suite created
- [x] Breaking point identified (380 VUs)
- [x] Benchmarks documented
- [x] CI/CD integrated

**Monitoring & Metrics**:

- [x] 15+ custom metrics
- [x] Grafana dashboard
- [x] 7 alert rules
- [x] Monitoring guide

### Phase 5 Metrics

**Before**:

- No performance tests
- No custom metrics
- No monitoring dashboards
- Unknown scaling limits

**After**:

- Comprehensive performance test suite
- 15+ custom metrics
- Full monitoring dashboard
- Documented scaling capacity (300 concurrent users)

### Phase 5 Sign-Off

**Approvals Required**:

- [ ] Tech Lead - Performance review
- [ ] DevOps - Monitoring setup review
- [ ] DBA - Database optimization review

**Ready for Production**: ✅ / ❌

**Notes**:

- Phase 5 completion date: \***\*\_\_\*\***
- Total actual time: **\_\_\_** hours (estimated: 16-24 hours)
- Performance improvement: **\_\_\_**% faster
- Scaling capacity: **\_\_\_** concurrent users

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**Status**: Ready for execution
