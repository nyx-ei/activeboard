/**
 * Real App Load Test
 * Tests against the actual running app with real Supabase database
 * Run with: k6 run -e SCENARIO=load real-app-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { config, getScenario } from './config.js';

// Custom metrics
const usersCreatedCount = new Counter('users_created');
const groupsCreatedCount = new Counter('groups_created');
const requestsCount = new Counter('total_requests');

// Get test scenario from environment or default to 'smoke'
const scenarioName = __ENV.SCENARIO || 'smoke';
const scenario = getScenario(scenarioName);

export const options = {
  stages: scenario.stages,
  thresholds: scenario.thresholds,
};

// Helper to generate unique test email
function generateTestEmail(userId) {
  const timestamp = Date.now();
  return `loadtest-${userId}-${timestamp}@test.local`;
}

export default function (data) {
  const userId = `user-${__VU}-${__ITER}`;
  const email = generateTestEmail(__VU);
  const password = 'TestPassword123!';
  const displayName = `Load Test User ${__VU}`;

  group('Health Check', () => {
    // Check if app is responding
    const healthRes = http.get(`${config.baseUrl}/`, {
      headers: {
        'User-Agent': 'k6-load-test',
      },
    });

    check(healthRes, {
      'app is responding': (r) => r.status === 200 || r.status === 307,
      'no server errors': (r) => r.status < 500,
    });

    requestsCount.add(1);
    sleep(0.2);
  });

  group('User Signup', () => {
    // Create a new user via signup API
    const signupRes = http.post(
      `${config.baseUrl}/api/auth/signup`,
      JSON.stringify({
        email,
        password,
        displayName,
        locale: 'en',
        examSession: 'april_may_2026',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    check(signupRes, {
      'signup returns 200': (r) => r.status === 200,
      'signup returns ok': (r) => r.body.includes('ok') || r.body.includes('true'),
    });

    if (signupRes.status === 200) {
      usersCreatedCount.add(1);
    }

    requestsCount.add(1);
    sleep(0.5);
  });

  group('Fetch Live Groups', () => {
    // Get available groups - this endpoint doesn't require auth
    const groupsRes = http.get(
      `${config.baseUrl}/api/live-groups?locale=en`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    check(groupsRes, {
      'groups endpoint responds': (r) => r.status === 200 || r.status === 401,
      'returns json': (r) => {
        const contentType = r.headers['content-type'] || '';
        return contentType.includes('application/json');
      },
    });

    requestsCount.add(1);
    sleep(0.3);
  });

  group('Dashboard Access', () => {
    // Test accessing dashboard page
    const dashboardRes = http.get(`${config.baseUrl}/en/dashboard`, {
      headers: {
        'User-Agent': 'k6-load-test',
      },
      // Allow redirects
      redirects: 5,
    });

    check(dashboardRes, {
      'dashboard page loads': (r) => r.status === 200 || r.status === 307,
    });

    requestsCount.add(1);
    sleep(0.5);
  });

  sleep(Math.random() * 2); // Random cooldown
}
