/**
 * k6 Load Test Suite - FlyAndEarn Admin Panel
 *
 * Installation:
 *   brew install k6  (macOS)
 *   apt-get install k6  (Linux)
 *   choco install k6  (Windows)
 *
 * Usage:
 *   k6 run load/k6-admin.js                    # Default test
 *   k6 run --vus 50 --duration 2m load/k6-admin.js  # Custom config
 *   k6 run -e BASE_URL=http://localhost:3001 load/k6-admin.js  # Custom URL
 *
 * Scenarios:
 *   k6 run --env SCENARIO=smoke load/k6-admin.js       # Quick validation
 *   k6 run --env SCENARIO=load load/k6-admin.js        # Normal load test
 *   k6 run --env SCENARIO=stress load/k6-admin.js      # Stress test
 *   k6 run --env SCENARIO=spike load/k6-admin.js       # Spike test
 *   k6 run --env SCENARIO=soak load/k6-admin.js        # Endurance test
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const dashboardResponseTime = new Trend('dashboard_response_time');
const usersResponseTime = new Trend('users_response_time');
const subscriptionsResponseTime = new Trend('subscriptions_response_time');
const funnelsResponseTime = new Trend('funnels_response_time');
const healthResponseTime = new Trend('health_response_time');
const apiCalls = new Counter('api_calls');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const SCENARIO = __ENV.SCENARIO || 'load';

// Test scenarios
const scenarios = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '1m',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 20 },  // Ramp up to 20 users
      { duration: '5m', target: 20 },  // Stay at 20 users
      { duration: '2m', target: 50 },  // Ramp up to 50 users
      { duration: '5m', target: 50 },  // Stay at 50 users
      { duration: '2m', target: 0 },   // Ramp down
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 150 },
      { duration: '5m', target: 150 },
      { duration: '5m', target: 0 },
    ],
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 10 },
      { duration: '30s', target: 200 }, // Spike!
      { duration: '1m', target: 200 },
      { duration: '30s', target: 10 },
      { duration: '2m', target: 10 },
      { duration: '1m', target: 0 },
    ],
  },
  soak: {
    executor: 'constant-vus',
    vus: 30,
    duration: '30m',
  },
};

export const options = {
  scenarios: {
    default: scenarios[SCENARIO],
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // 95% < 2s, 99% < 5s
    http_req_failed: ['rate<0.01'],                   // <1% error rate
    errors: ['rate<0.05'],                            // <5% custom error rate
    dashboard_response_time: ['p(95)<3000'],          // Dashboard specific
    users_response_time: ['p(95)<2500'],              // Users endpoint
    subscriptions_response_time: ['p(95)<3000'],      // Subscriptions endpoint
    funnels_response_time: ['p(95)<3000'],            // Funnels endpoint
    health_response_time: ['p(95)<1000'],             // Health endpoint (fast)
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Session cookie storage (simulated)
let sessionCookie = '';

// Login helper
function login() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: 'admin',
    password: 'admin123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });

  // Extract session cookie
  const cookies = loginRes.cookies;
  if (cookies && cookies['admin_session']) {
    sessionCookie = `admin_session=${cookies['admin_session'][0].value}`;
  }

  return loginRes;
}

// Default headers
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Cookie': sessionCookie,
  };
}

// Main test function
export default function() {
  // Login if no session
  if (!sessionCookie) {
    group('authentication', function() {
      login();
    });
  }

  // Test dashboard endpoint
  group('dashboard', function() {
    const ranges = ['7d', '30d', '90d'];
    const range = ranges[Math.floor(Math.random() * ranges.length)];

    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/admin/dashboard?range=${range}`, {
      headers: getHeaders(),
    });
    const duration = Date.now() - start;

    dashboardResponseTime.add(duration);
    apiCalls.add(1);

    const success = check(res, {
      'dashboard status 200': (r) => r.status === 200,
      'dashboard has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true && body.data && body.data.kpis;
        } catch (e) {
          return false;
        }
      },
      'dashboard response time OK': (r) => r.timings.duration < 3000,
    });

    errorRate.add(!success);
    sleep(0.5);
  });

  // Test users endpoint
  group('users', function() {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/admin/users?page=1&limit=20`, {
      headers: getHeaders(),
    });
    const duration = Date.now() - start;

    usersResponseTime.add(duration);
    apiCalls.add(1);

    const success = check(res, {
      'users status 200': (r) => r.status === 200,
      'users has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true && Array.isArray(body.data.users);
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(!success);
    sleep(0.3);
  });

  // Test subscriptions analytics endpoint
  group('subscriptions', function() {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/admin/subscriptions/analytics?range=30d`, {
      headers: getHeaders(),
    });
    const duration = Date.now() - start;

    subscriptionsResponseTime.add(duration);
    apiCalls.add(1);

    const success = check(res, {
      'subscriptions status 200': (r) => r.status === 200,
      'subscriptions has MRR': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true && body.data && body.data.summary;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(!success);
    sleep(0.5);
  });

  // Test funnels endpoint
  group('funnels', function() {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/admin/metrics/funnels?range=30d`, {
      headers: getHeaders(),
    });
    const duration = Date.now() - start;

    funnelsResponseTime.add(duration);
    apiCalls.add(1);

    const success = check(res, {
      'funnels status 200': (r) => r.status === 200,
      'funnels has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true && body.data && body.data.acquisitionFunnel;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(!success);
    sleep(0.3);
  });

  // Test health endpoint
  group('health', function() {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/admin/metrics/health`, {
      headers: getHeaders(),
    });
    const duration = Date.now() - start;

    healthResponseTime.add(duration);
    apiCalls.add(1);

    const success = check(res, {
      'health status 200': (r) => r.status === 200,
      'health has status': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true && body.data && body.data.overall;
        } catch (e) {
          return false;
        }
      },
      'health is fast': (r) => r.timings.duration < 1000,
    });

    errorRate.add(!success);
    sleep(0.2);
  });

  // Test requests endpoint
  group('requests', function() {
    const res = http.get(`${BASE_URL}/api/admin/requests?page=1&limit=20`, {
      headers: getHeaders(),
    });
    apiCalls.add(1);

    const success = check(res, {
      'requests status 200': (r) => r.status === 200,
    });

    errorRate.add(!success);
    sleep(0.3);
  });

  // Test matches endpoint
  group('matches', function() {
    const res = http.get(`${BASE_URL}/api/admin/matches?page=1&limit=20`, {
      headers: getHeaders(),
    });
    apiCalls.add(1);

    const success = check(res, {
      'matches status 200': (r) => r.status === 200,
    });

    errorRate.add(!success);
    sleep(0.3);
  });

  // Test wallet endpoint
  group('wallet', function() {
    const res = http.get(`${BASE_URL}/api/admin/wallet?page=1&limit=20`, {
      headers: getHeaders(),
    });
    apiCalls.add(1);

    const success = check(res, {
      'wallet status 200': (r) => r.status === 200,
    });

    errorRate.add(!success);
    sleep(0.3);
  });

  // Test audit logs endpoint
  group('logs', function() {
    const res = http.get(`${BASE_URL}/api/admin/logs?page=1&limit=50`, {
      headers: getHeaders(),
    });
    apiCalls.add(1);

    const success = check(res, {
      'logs status 200': (r) => r.status === 200,
    });

    errorRate.add(!success);
    sleep(0.3);
  });

  // Random think time between iterations
  sleep(Math.random() * 2 + 1);
}

// Setup function - runs once before test
export function setup() {
  console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
  console.log(`║        FlyAndEarn Admin Panel Load Test                    ║`);
  console.log(`║        Scenario: ${SCENARIO.toUpperCase().padEnd(40)}║`);
  console.log(`║        Target: ${BASE_URL.padEnd(42)}║`);
  console.log(`╚═══════════════════════════════════════════════════════════╝\n`);

  // Verify server is reachable
  const healthCheck = http.get(`${BASE_URL}/api/admin/metrics/health`);
  if (healthCheck.status !== 200) {
    console.warn(`Warning: Health check returned status ${healthCheck.status}`);
  }

  return { startTime: Date.now() };
}

// Teardown function - runs once after test
export function teardown(data) {
  const duration = ((Date.now() - data.startTime) / 1000).toFixed(0);
  console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
  console.log(`║        Load Test Complete                                  ║`);
  console.log(`║        Duration: ${duration}s`.padEnd(60) + `║`);
  console.log(`╚═══════════════════════════════════════════════════════════╝\n`);
}

// Summary handler
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load/results/summary.json': JSON.stringify(data, null, 2),
    'load/results/summary.html': htmlReport(data),
  };
}

// Text summary helper
function textSummary(data, options) {
  const { metrics } = data;

  let output = '\n=== PERFORMANCE SUMMARY ===\n\n';

  // Key metrics
  output += `HTTP Requests:\n`;
  output += `  Total:    ${metrics.http_reqs?.values?.count || 0}\n`;
  output += `  Rate:     ${(metrics.http_reqs?.values?.rate || 0).toFixed(2)}/s\n`;
  output += `  Failed:   ${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%\n\n`;

  output += `Response Times:\n`;
  output += `  Avg:      ${(metrics.http_req_duration?.values?.avg || 0).toFixed(0)}ms\n`;
  output += `  p(90):    ${(metrics.http_req_duration?.values['p(90)'] || 0).toFixed(0)}ms\n`;
  output += `  p(95):    ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(0)}ms\n`;
  output += `  p(99):    ${(metrics.http_req_duration?.values['p(99)'] || 0).toFixed(0)}ms\n\n`;

  output += `Custom Metrics:\n`;
  output += `  Dashboard p(95):      ${(metrics.dashboard_response_time?.values['p(95)'] || 0).toFixed(0)}ms\n`;
  output += `  Users p(95):          ${(metrics.users_response_time?.values['p(95)'] || 0).toFixed(0)}ms\n`;
  output += `  Subscriptions p(95):  ${(metrics.subscriptions_response_time?.values['p(95)'] || 0).toFixed(0)}ms\n`;
  output += `  Funnels p(95):        ${(metrics.funnels_response_time?.values['p(95)'] || 0).toFixed(0)}ms\n`;
  output += `  Health p(95):         ${(metrics.health_response_time?.values['p(95)'] || 0).toFixed(0)}ms\n`;
  output += `  Error Rate:           ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%\n`;
  output += `  Total API Calls:      ${metrics.api_calls?.values?.count || 0}\n\n`;

  // Threshold results
  output += `Thresholds:\n`;
  const thresholds = data.root_group?.checks || {};
  for (const [name, threshold] of Object.entries(thresholds)) {
    const passed = threshold.passes || 0;
    const failed = threshold.fails || 0;
    const total = passed + failed;
    const status = failed === 0 ? '✓' : '✗';
    output += `  ${status} ${name}: ${passed}/${total}\n`;
  }

  return output;
}

// HTML report generator
function htmlReport(data) {
  const { metrics } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>FlyAndEarn Admin - Load Test Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #0f0f0f; color: #fff; }
    h1 { color: #d4af37; }
    h2 { color: #fff; border-bottom: 1px solid #333; padding-bottom: 10px; }
    .metric { background: #1a1a1a; padding: 20px; margin: 10px 0; border-radius: 8px; border: 1px solid #333; }
    .metric h3 { margin: 0 0 10px 0; color: #d4af37; }
    .metric .value { font-size: 32px; font-weight: bold; }
    .metric .label { color: #888; font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .pass { color: #22c55e; }
    .fail { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #333; }
    th { background: #1a1a1a; color: #d4af37; }
    tr:hover { background: #1a1a1a; }
  </style>
</head>
<body>
  <h1>FlyAndEarn Admin Panel - Load Test Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>

  <h2>Summary</h2>
  <div class="grid">
    <div class="metric">
      <h3>Total Requests</h3>
      <div class="value">${metrics.http_reqs?.values?.count || 0}</div>
      <div class="label">HTTP Requests</div>
    </div>
    <div class="metric">
      <h3>Request Rate</h3>
      <div class="value">${(metrics.http_reqs?.values?.rate || 0).toFixed(1)}/s</div>
      <div class="label">Requests per second</div>
    </div>
    <div class="metric">
      <h3>Avg Response Time</h3>
      <div class="value">${(metrics.http_req_duration?.values?.avg || 0).toFixed(0)}ms</div>
      <div class="label">Mean duration</div>
    </div>
    <div class="metric">
      <h3>Error Rate</h3>
      <div class="value ${(metrics.http_req_failed?.values?.rate || 0) < 0.01 ? 'pass' : 'fail'}">${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%</div>
      <div class="label">Failed requests</div>
    </div>
  </div>

  <h2>Response Time Percentiles</h2>
  <table>
    <tr><th>Percentile</th><th>Duration</th></tr>
    <tr><td>p(50) - Median</td><td>${(metrics.http_req_duration?.values?.med || 0).toFixed(0)}ms</td></tr>
    <tr><td>p(90)</td><td>${(metrics.http_req_duration?.values['p(90)'] || 0).toFixed(0)}ms</td></tr>
    <tr><td>p(95)</td><td>${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(0)}ms</td></tr>
    <tr><td>p(99)</td><td>${(metrics.http_req_duration?.values['p(99)'] || 0).toFixed(0)}ms</td></tr>
  </table>

  <h2>Endpoint Performance</h2>
  <table>
    <tr><th>Endpoint</th><th>p(95)</th><th>Target</th><th>Status</th></tr>
    <tr>
      <td>Dashboard</td>
      <td>${(metrics.dashboard_response_time?.values['p(95)'] || 0).toFixed(0)}ms</td>
      <td>&lt;3000ms</td>
      <td class="${(metrics.dashboard_response_time?.values['p(95)'] || 0) < 3000 ? 'pass' : 'fail'}">${(metrics.dashboard_response_time?.values['p(95)'] || 0) < 3000 ? 'PASS' : 'FAIL'}</td>
    </tr>
    <tr>
      <td>Users</td>
      <td>${(metrics.users_response_time?.values['p(95)'] || 0).toFixed(0)}ms</td>
      <td>&lt;2500ms</td>
      <td class="${(metrics.users_response_time?.values['p(95)'] || 0) < 2500 ? 'pass' : 'fail'}">${(metrics.users_response_time?.values['p(95)'] || 0) < 2500 ? 'PASS' : 'FAIL'}</td>
    </tr>
    <tr>
      <td>Subscriptions</td>
      <td>${(metrics.subscriptions_response_time?.values['p(95)'] || 0).toFixed(0)}ms</td>
      <td>&lt;3000ms</td>
      <td class="${(metrics.subscriptions_response_time?.values['p(95)'] || 0) < 3000 ? 'pass' : 'fail'}">${(metrics.subscriptions_response_time?.values['p(95)'] || 0) < 3000 ? 'PASS' : 'FAIL'}</td>
    </tr>
    <tr>
      <td>Funnels</td>
      <td>${(metrics.funnels_response_time?.values['p(95)'] || 0).toFixed(0)}ms</td>
      <td>&lt;3000ms</td>
      <td class="${(metrics.funnels_response_time?.values['p(95)'] || 0) < 3000 ? 'pass' : 'fail'}">${(metrics.funnels_response_time?.values['p(95)'] || 0) < 3000 ? 'PASS' : 'FAIL'}</td>
    </tr>
    <tr>
      <td>Health</td>
      <td>${(metrics.health_response_time?.values['p(95)'] || 0).toFixed(0)}ms</td>
      <td>&lt;1000ms</td>
      <td class="${(metrics.health_response_time?.values['p(95)'] || 0) < 1000 ? 'pass' : 'fail'}">${(metrics.health_response_time?.values['p(95)'] || 0) < 1000 ? 'PASS' : 'FAIL'}</td>
    </tr>
  </table>

</body>
</html>
`;
}
