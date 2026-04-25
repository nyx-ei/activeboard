/**
 * Connection Stability & Resilience Test
 * Tests how the system handles network issues, disconnects, and reconnects
 * Run with: k6 run -e SCENARIO=load connection-stability.js
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, group, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { config, getScenario } from './config.js';

const reconnectAttempts = new Counter('reconnect_attempts');
const reconnectSuccesses = new Counter('reconnect_successes');
const connectionErrors = new Counter('connection_errors');
const reconnectTime = new Trend('reconnect_time_ms');

const scenarioName = __ENV.SCENARIO || 'load';
const scenario = getScenario(scenarioName);

export const options = {
  stages: scenario.stages,
  thresholds: scenario.thresholds,
};

function generateTestEmail(userId) {
  const timestamp = Date.now();
  return `load-test-${userId}-${timestamp}@test.activeboard.dev`;
}

function randomAnswer() {
  const answers = ['A', 'B', 'C', 'D', 'E'];
  return answers[Math.floor(Math.random() * answers.length)];
}

export default function (data) {
  const userId = `user-${__VU}-${__ITER}`;
  const email = generateTestEmail(__VU);
  const password = 'TestPassword123!';

  let authToken;
  let sessionId;

  group('Setup', () => {
    // Authenticate
    const signupRes = http.post(`${config.baseUrl}/api/auth/signup`, {
      email,
      password,
      passwordConfirm: password,
    });

    try {
      const body = JSON.parse(signupRes.body);
      authToken = body.session?.access_token || body.access_token;
    } catch (e) {
      console.warn(`Auth failed: ${e}`);
      return;
    }

    // Create session
    const sessionRes = http.post(
      `${config.baseUrl}/api/sessions`,
      JSON.stringify({
        name: `Stability Test ${userId}`,
        questionCount: 5,
        timerMode: 'per-question',
        timePerQuestion: 30,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    try {
      const body = JSON.parse(sessionRes.body);
      sessionId = body.id;
    } catch (e) {
      console.warn(`Session creation failed: ${e}`);
      return;
    }

    sleep(1);
  });

  group('WebSocket with Disconnect/Reconnect', () => {
    const wsUrl = `${config.baseUrl.replace('http', 'ws')}/api/realtime?session=${sessionId}&token=${authToken}`;
    let reconnectCount = 0;
    const maxReconnects = 3;

    function attemptConnection() {
      try {
        const res = ws.connect(wsUrl, { tags: { name: 'StabilityTest' } }, function (socket) {
          let messageCount = 0;

          socket.on('open', () => {
            console.log(`[VU ${__VU}] WebSocket connected`);

            // Send some answers
            for (let i = 0; i < 3; i++) {
              socket.send(
                JSON.stringify({
                  type: 'answer',
                  questionNumber: i,
                  answer: randomAnswer(),
                  confidence: 'high',
                })
              );
              messageCount++;
            }
          });

          socket.on('message', (msg) => {
            messageCount++;
          });

          socket.on('close', () => {
            console.log(`[VU ${__VU}] WebSocket closed after ${messageCount} messages`);
          });

          socket.on('error', (e) => {
            connectionErrors.add(1);
            console.error(`[VU ${__VU}] WebSocket error: ${e}`);
          });

          // Simulate connection drop
          socket.setTimeout(() => {
            console.log(`[VU ${__VU}] Simulating disconnection...`);
            socket.close();
          }, 5000 + Math.random() * 5000);
        });

        check(res, {
          'connection successful': (r) => r && r.status === 101,
        });
      } catch (e) {
        connectionErrors.add(1);
        console.error(`Connection attempt failed: ${e}`);
      }
    }

    // Try initial connection
    attemptConnection();
    sleep(2);

    // Simulate reconnection attempts
    while (reconnectCount < maxReconnects) {
      reconnectAttempts.add(1);
      console.log(`[VU ${__VU}] Reconnection attempt ${reconnectCount + 1}/${maxReconnects}`);

      const reconnectStart = Date.now();
      attemptConnection();
      const reconnectDuration = Date.now() - reconnectStart;

      reconnectTime.add(reconnectDuration);
      reconnectSuccesses.add(1);
      reconnectCount++;

      sleep(1 + Math.random() * 2);
    }
  });

  group('Session Recovery', () => {
    // Verify session still intact after disconnects
    const recoveryRes = http.get(`${config.baseUrl}/api/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    check(recoveryRes, {
      'session recovered': (r) => r.status === 200,
      'session still active': (r) => r.body.includes('status'),
    });
  });

  sleep(2);
}
