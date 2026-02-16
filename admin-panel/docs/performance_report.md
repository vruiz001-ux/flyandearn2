# Performance Report - FlyAndEarn Admin Panel

## Overview

This document outlines the performance requirements, testing methodology, and baseline metrics for the FlyAndEarn Admin Panel.

---

## Performance Requirements

### Response Time SLAs

| Endpoint Category | p(50) Target | p(95) Target | p(99) Target |
|-------------------|--------------|--------------|--------------|
| Dashboard         | < 500ms      | < 2000ms     | < 3000ms     |
| User List         | < 300ms      | < 1500ms     | < 2500ms     |
| Subscriptions     | < 500ms      | < 2000ms     | < 3000ms     |
| Funnels           | < 500ms      | < 2000ms     | < 3000ms     |
| Health Check      | < 100ms      | < 500ms      | < 1000ms     |
| Audit Logs        | < 300ms      | < 1500ms     | < 2500ms     |
| Static Assets     | < 50ms       | < 200ms      | < 500ms      |

### Throughput Requirements

| Metric                      | Target          |
|-----------------------------|-----------------|
| Concurrent Admin Users      | 50+ users       |
| Requests per Second         | 100+ RPS        |
| Error Rate                  | < 1%            |
| Availability                | 99.9%           |

### Resource Limits

| Resource    | Limit             |
|-------------|-------------------|
| Memory      | < 512MB per pod   |
| CPU         | < 0.5 cores       |
| DB Connections | < 20 per pod   |

---

## Test Scenarios

### 1. Smoke Test
- **Purpose**: Quick validation that system works under minimal load
- **VUs**: 1
- **Duration**: 1 minute
- **Command**: `k6 run --env SCENARIO=smoke load/k6-admin.js`

### 2. Load Test
- **Purpose**: Validate system under expected production load
- **VUs**: 20-50 ramping
- **Duration**: ~16 minutes
- **Command**: `k6 run --env SCENARIO=load load/k6-admin.js`

### 3. Stress Test
- **Purpose**: Find system breaking point
- **VUs**: 50-150 ramping
- **Duration**: ~26 minutes
- **Command**: `k6 run --env SCENARIO=stress load/k6-admin.js`

### 4. Spike Test
- **Purpose**: Validate system handles sudden traffic spikes
- **VUs**: 10 → 200 → 10 rapid change
- **Duration**: ~6 minutes
- **Command**: `k6 run --env SCENARIO=spike load/k6-admin.js`

### 5. Soak Test
- **Purpose**: Find memory leaks and degradation over time
- **VUs**: 30 constant
- **Duration**: 30 minutes
- **Command**: `k6 run --env SCENARIO=soak load/k6-admin.js`

---

## Baseline Results

### Test Environment
- **Date**: [To be filled after test run]
- **Environment**: Local Development
- **Database**: PostgreSQL (local)
- **Node Version**: 20.x
- **Hardware**: [Your machine specs]

### Load Test Results (50 VUs)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Requests | - | - | - |
| Request Rate | - | 100 RPS | - |
| Avg Response Time | - | - | - |
| p(95) Response Time | - | < 2000ms | - |
| p(99) Response Time | - | < 5000ms | - |
| Error Rate | - | < 1% | - |

### Endpoint Breakdown

| Endpoint | Avg | p(95) | p(99) | Status |
|----------|-----|-------|-------|--------|
| Dashboard | - | - | - | - |
| Users | - | - | - | - |
| Subscriptions | - | - | - | - |
| Funnels | - | - | - | - |
| Health | - | - | - | - |
| Requests | - | - | - | - |
| Matches | - | - | - | - |
| Wallet | - | - | - | - |
| Logs | - | - | - | - |

---

## Performance Optimization Recommendations

### Database Optimizations

1. **Index Coverage**
   - Ensure all frequently queried columns have indexes
   - Current indexes in schema:
     - `users`: email, status, createdAt
     - `requests`: requesterId, status, category, createdAt, deliveryCountry
     - `matches`: requestId, travellerId, status, createdAt
     - `events`: type, userId, createdAt, sessionId, deviceType, source
     - `subscriptions`: userId, planId, status, createdAt, currentPeriodEnd

2. **Query Optimization**
   - Use `select` to fetch only needed fields
   - Avoid N+1 queries with proper `include` usage
   - Use `aggregate` for count/sum operations
   - Consider materialized views for complex analytics

3. **Connection Pooling**
   - Configure PgBouncer for connection pooling
   - Set appropriate pool size based on load

### Caching Strategy

1. **Dashboard Data**
   - Cache aggregated KPIs with 1-minute TTL
   - Use Redis for shared cache across instances

2. **Static Reference Data**
   - Cache plan list (rarely changes)
   - Cache country/category lists

3. **User Sessions**
   - Use Redis for session storage in production

### Code Optimizations

1. **Parallel Queries**
   - Use `Promise.all` for independent database queries
   - Already implemented in dashboard endpoint

2. **Pagination**
   - Always use pagination for list endpoints
   - Default limit: 20, max: 100

3. **Response Compression**
   - Enable gzip compression in production

---

## Monitoring

### Key Metrics to Monitor

1. **Application Metrics**
   - Request latency (p50, p95, p99)
   - Error rate
   - Request throughput

2. **Database Metrics**
   - Query execution time
   - Connection pool utilization
   - Lock contention

3. **System Metrics**
   - CPU utilization
   - Memory usage
   - Network I/O

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| p95 Latency | > 2s | > 5s |
| Error Rate | > 0.5% | > 2% |
| CPU Usage | > 70% | > 90% |
| Memory Usage | > 70% | > 90% |
| DB Connections | > 80% pool | > 95% pool |

---

## Running Tests

### Prerequisites
```bash
# Install k6
brew install k6  # macOS
# or
apt-get install k6  # Linux

# Start the admin panel
cd admin-panel
npm run dev
```

### Quick Test Commands

```bash
# Smoke test
k6 run --env SCENARIO=smoke load/k6-admin.js

# Standard load test
k6 run --env SCENARIO=load load/k6-admin.js

# Stress test
k6 run --env SCENARIO=stress load/k6-admin.js

# Custom configuration
k6 run --vus 30 --duration 5m load/k6-admin.js

# With custom base URL
k6 run -e BASE_URL=http://staging.example.com load/k6-admin.js
```

### Output Files
After test completion, results are saved to:
- `load/results/summary.json` - Raw JSON data
- `load/results/summary.html` - HTML report

---

## Historical Results

| Date | Scenario | VUs | Duration | RPS | p95 | Error Rate | Status |
|------|----------|-----|----------|-----|-----|------------|--------|
| - | - | - | - | - | - | - | - |

---

## Action Items

- [ ] Run baseline load test and document results
- [ ] Set up continuous performance monitoring
- [ ] Configure alerting thresholds
- [ ] Implement caching layer
- [ ] Add database query logging for slow queries
- [ ] Document performance regression process
