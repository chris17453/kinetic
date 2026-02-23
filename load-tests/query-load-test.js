import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp up
    { duration: '2m',  target: 50 },   // sustained load
    { duration: '30s', target: 100 },  // peak
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // 95% of requests under 3s
    http_req_failed: ['rate<0.01'],     // less than 1% failure
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const errorRate = new Rate('errors');
const queryDuration = new Trend('query_duration');

export function setup() {
  // Login once and share token across VUs
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: __ENV.TEST_EMAIL || 'test@example.com',
    password: __ENV.TEST_PASSWORD || 'Test1234!'
  }), { headers: { 'Content-Type': 'application/json' } });

  if (res.status === 200) {
    return { token: res.json('token') };
  }
  return { token: null };
}

export default function(data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': data.token ? `Bearer ${data.token}` : '',
  };

  // Test 1: List reports
  const listRes = http.get(`${BASE_URL}/api/reports`, { headers });
  check(listRes, { 'list reports 200': (r) => r.status === 200 });
  errorRate.add(listRes.status !== 200);

  sleep(0.5);

  // Test 2: Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, { 'health 200': (r) => r.status === 200 });

  sleep(0.5);

  // Test 3: Get connections (requires auth)
  const connRes = http.get(`${BASE_URL}/api/connections`, { headers });
  check(connRes, { 'connections 200 or 401': (r) => r.status === 200 || r.status === 401 });

  sleep(1);
}

export function teardown(data) {
  // Nothing to clean up
}
