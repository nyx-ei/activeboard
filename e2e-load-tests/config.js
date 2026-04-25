/**
 * Load test configuration
 * Adjust these values based on your performance targets
 */

export const config = {
  // Test environment
  baseUrl: __ENV.BASE_URL || 'http://localhost:3000',
  supabaseUrl: __ENV.SUPABASE_URL || 'http://localhost:54321',

  // Test duration and load
  testScenarios: {
    smoke: {
      description: 'Quick sanity check (5 users, 1 min)',
      stages: [
        { duration: '10s', target: 5 },
        { duration: '50s', target: 5 },
      ],
      thresholds: {
        'http_req_duration': ['p(95)<500', 'p(99)<1000'],
        'http_req_failed': ['rate<0.01'],
      },
    },
    load: {
      description: 'Normal load test (100 users ramping up, 5 mins)',
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m30s', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      thresholds: {
        'http_req_duration': ['p(95)<500', 'p(99)<1000'],
        'http_req_failed': ['rate<0.01'],
      },
    },
    stress: {
      description: 'Stress test (500 users peak, 10 mins)',
      stages: [
        { duration: '1m', target: 100 },
        { duration: '1m', target: 250 },
        { duration: '2m', target: 500 },
        { duration: '2m', target: 500 },
        { duration: '1m', target: 250 },
        { duration: '1m', target: 0 },
      ],
      thresholds: {
        'http_req_duration': ['p(95)<500', 'p(99)<1000'],
        'http_req_failed': ['rate<0.01'],
      },
    },
    spike: {
      description: 'Spike test (sudden jump to 200 users)',
      stages: [
        { duration: '30s', target: 50 },
        { duration: '30s', target: 200 },
        { duration: '1m', target: 200 },
        { duration: '30s', target: 0 },
      ],
      thresholds: {
        'http_req_duration': ['p(95)<500', 'p(99)<1000'],
        'http_req_failed': ['rate<0.01'],
      },
    },
  },

  // Session configuration
  session: {
    questionCount: 10,
    timePerQuestion: 30, // seconds
  },

  // User data for testing
  testUsers: [
    { email: 'load-test-1@example.com', password: 'TestPassword123!' },
    { email: 'load-test-2@example.com', password: 'TestPassword123!' },
    { email: 'load-test-3@example.com', password: 'TestPassword123!' },
  ],
};

export function getScenario(name) {
  return config.testScenarios[name] || config.testScenarios.smoke;
}
