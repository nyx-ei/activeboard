# ActiveBoard Load Testing Suite

Load testing suite using [k6](https://k6.io) to validate ActiveBoard's performance under concurrent user load.

## Overview

This suite tests how the ActiveBoard system handles:
- **Hundreds of simultaneous sessions** with real-time WebSocket connections
- **Timer synchronization** across many concurrent users
- **Session state consistency** under load
- **Connection stability** and recovery from disconnects
- **Performance regressions** against baseline metrics

## Test Scripts

### 1. **session-lifecycle.js**
Complete user journey: authenticate → create session → answer questions → submit → review

**Metrics collected:**
- HTTP request latencies (p95, p99)
- WebSocket message throughput
- Session creation rate
- Question answer throughput
- Review submission success

### 2. **connection-stability.js**
Tests network resilience: disconnect simulation, reconnection attempts, state recovery

**Metrics collected:**
- Reconnection success rate
- Reconnection time (latency)
- Connection error rates
- Session recovery after drops

## Prerequisites

### Option 1: Direct k6 Installation (Recommended)

```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3232A
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6-archive.list
sudo apt-get update
sudo apt-get install k6

# Verify installation
k6 version
```

### Option 2: Docker

```bash
docker build -t activeboard-load-tests .
```

### Option 3: Cloud k6 (k6 Cloud)

```bash
# Create account at https://cloud.k6.io
k6 login cloud
```

## Running Tests

### Setup Environment

1. Start your ActiveBoard development server:
```bash
npm run dev
```

2. Set environment variables (optional):
```bash
export BASE_URL=http://localhost:3000
export SCENARIO=smoke
```

### Run Smoke Test (Quick Sanity Check)
```bash
k6 run -e SCENARIO=smoke session-lifecycle.js
```
- **Duration:** ~2 minutes
- **VUs:** Ramps up to 5
- **Good for:** Quick CI validation, syntax checking

### Run Load Test (Normal Capacity)
```bash
k6 run -e SCENARIO=load session-lifecycle.js
```
- **Duration:** ~5 minutes
- **VUs:** Ramps up to 100
- **Good for:** Baseline performance validation

### Run Stress Test (Peak Load)
```bash
k6 run -e SCENARIO=stress session-lifecycle.js
```
- **Duration:** ~10 minutes
- **VUs:** Ramps up to 500
- **Good for:** Find breaking point, capacity planning

### Run Spike Test (Sudden Spike)
```bash
k6 run -e SCENARIO=spike session-lifecycle.js
```
- **Duration:** ~3 minutes
- **VUs:** Sudden jump from 50 → 200
- **Good for:** Test recovery from sudden traffic spikes

### Run Connection Stability Test
```bash
k6 run -e SCENARIO=load connection-stability.js
```
- **Duration:** ~5 minutes
- **VUs:** Varies by scenario
- **Good for:** Resilience and reconnection handling

## Running with Docker

```bash
# Smoke test
docker run --rm \
  -e BASE_URL=http://host.docker.internal:3000 \
  -e SCENARIO=smoke \
  activeboard-load-tests run session-lifecycle.js

# Stress test
docker run --rm \
  -e BASE_URL=http://host.docker.internal:3000 \
  -e SCENARIO=stress \
  activeboard-load-tests run session-lifecycle.js
```

## Understanding the Output

### Key Metrics

```
✓ http_req_duration.............: p(95)=500ms p(99)=1000ms  ← HTTP latency (should be < threshold)
✓ http_req_failed..............: 0%                        ← Error rate (should be < 5%)
✓ sessions_created.............: 452                       ← Total sessions created
✓ questions_answered............: 4520                      ← Total answers submitted
✓ submissions_completed.........: 452                       ← Full submissions
✓ ws_messages_received..........: 18080                     ← WebSocket traffic
✓ realtime_sync_duration_ms....: avg=2405ms               ← WebSocket connection time
✓ reconnect_successes...........: 89%                       ← Connection recovery rate
```

### Pass/Fail Thresholds

Tests pass when all thresholds are met (configured in `config.js`):

**Aggressive SLA — Consistent across all scenarios:**

| Scenario | p95 Latency | p99 Latency | Error Rate | Details |
|----------|-----------|-----------|-----------|---------|
| **Smoke** | < 500ms | < 1000ms | < 1% | Quick validation |
| **Load** | < 500ms | < 1000ms | < 1% | Normal operations (100 users) |
| **Stress** | < 500ms | < 1000ms | < 1% | At capacity (500 users) |
| **Spike** | < 500ms | < 1000ms | < 1% | Under sudden spike (200 users) |

⚡ **Note:** Same SLAs everywhere means you're validating that your system maintains performance guarantees even under peak load—a strong signal for reliability.

## Interpreting Results

### Good Signs ✅
- p95 latency under threshold consistently
- < 5% error rate
- Stable response times across ramp-up
- WebSocket connections maintain < 1% disconnection rate
- Linear scaling up to peak VUs

### Red Flags 🚩
- Sudden latency spike at specific VU count
- Error rate increasing over time (memory leak?)
- WebSocket disconnections > 5%
- p99 latency > 10x p95 (outliers indicate queueing)
- Repeated timeouts at same stages

## Performance Troubleshooting

### High Latency (> 1000ms for load test)

1. **Check API response times:**
   ```bash
   k6 run --out json=results.json session-lifecycle.js
   # Analyze results.json for slow endpoints
   ```

2. **Database query optimization:**
   - Review recent session-related queries
   - Add indexes for frequently queried fields
   - Consider connection pooling

3. **WebSocket bottleneck:**
   - Check Supabase Realtime subscription limits
   - Verify message broadcast rate
   - Consider message batching

### High Error Rate (> 5%)

1. **Check error logs:**
   ```bash
   k6 run --verbose session-lifecycle.js 2>&1 | grep -i error
   ```

2. **Common causes:**
   - Auth token expiration (increase session timeout)
   - Database connection limits (increase pool size)
   - Rate limiting (adjust thresholds)
   - Memory pressure (check server memory)

### WebSocket Disconnections

1. **Check network stability:**
   - Run `connection-stability.js` to isolate WebSocket issues
   - Verify server's WebSocket handler error logs
   - Check for proxy/firewall interference

2. **Increase reconnection backoff:**
   - Edit `connection-stability.js` to add exponential backoff
   - Verify message queuing on disconnect

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Tests

on: [push]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start dev server
        run: npm install && npm run build && npm run start &
        
      - name: Install k6
        run: sudo apt-get install -y k6
        
      - name: Run smoke test
        run: |
          cd e2e-load-tests
          k6 run -e SCENARIO=smoke \
                 -e BASE_URL=http://localhost:3000 \
                 session-lifecycle.js
```

## Performance Baselines

**Target baselines (aggressive SLA):**
- **p95 latency:** < 500ms (all scenarios)
- **p99 latency:** < 1000ms (all scenarios)
- **Error rate:** < 1% (all scenarios)
- **Expected session creation rate:** 100+ sessions/min
- **Expected concurrent capacity:** 500+ users

**Track your actual performance:**

| Date | Scenario | p95 | p99 | Errors | VUs | Status |
|------|----------|-----|-----|--------|-----|--------|
| 2026-04-24 | Baseline | — | — | — | — | PENDING |
| | | | | | | |

*After running your first test:* Copy results here to track improvements over time.

## Next Steps

1. **Establish baseline:** Run load tests on current production metrics
2. **CI integration:** Add smoke tests to every PR
3. **Automated alerts:** Set up performance regression alerts
4. **Profiling:** Use Grafana/Prometheus for deeper insights
5. **Capacity planning:** Use stress test results to plan scaling

## Useful Resources

- [k6 Official Docs](https://k6.io/docs/)
- [k6 WebSocket Documentation](https://k6.io/docs/javascript-api/k6-ws/)
- [Performance Best Practices](https://k6.io/docs/cloud/analyzing-results/thresholds/)
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/extensions/postgres-changes)

## Troubleshooting k6 Installation

### k6: command not found
```bash
# Try installing via npm
npm install -g k6

# Or use Docker
alias k6="docker run --rm -v \$PWD:/scripts grafana/k6"
k6 run session-lifecycle.js
```

### WebSocket connection timeout
- Ensure dev server is running on correct port
- Check firewall rules allow WebSocket connections
- Verify CORS/auth token configuration

### Memory errors with high VU count
- Run on machine with more RAM
- Lower VU count but run longer
- Use cloud k6 for distributed testing

## Questions?

Check the k6 community: https://community.k6.io
