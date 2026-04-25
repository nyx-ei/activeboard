# Load Testing Quick Start

## 1. Install k6

**Option A: Homebrew (macOS)**
```bash
brew install k6
k6 version  # Verify installation
```

**Option B: Docker**
```bash
docker build -t activeboard-load-tests .
docker run --rm activeboard-load-tests
```

**Option C: NPM (if you prefer)**
```bash
npm install -g k6
```

## 2. Start ActiveBoard Development Server

```bash
npm run dev
# Server runs on http://localhost:3000
```

## 3. Run Your First Load Test

### Smoke Test (2 min, 5 users)
```bash
npm run test:load:smoke
```

### Load Test (5 min, up to 100 users)
```bash
npm run test:load:load
```

### Stress Test (10 min, up to 500 users)
```bash
npm run test:load:stress
```

### Connection Stability Test (5 min, test disconnects/reconnects)
```bash
npm run test:load:stability
```

## 4. Interpret Results

When a test completes, look for:

✅ **Good signs:**
- `✓ http_req_duration` with p95 under threshold
- `✓ http_req_failed` showing rate < 5%
- Consistent metrics across VU ramp-up

❌ **Problems to investigate:**
- `✗ http_req_duration` exceeded threshold
- `✗ http_req_failed` high error rate
- Sudden latency spike at specific VU count

## 5. Run Custom Tests

```bash
# Custom scenario from command line
k6 run -e SCENARIO=load -e BASE_URL=http://localhost:3000 \
  e2e-load-tests/session-lifecycle.js

# From within e2e-load-tests directory
cd e2e-load-tests
k6 run -e SCENARIO=smoke session-lifecycle.js
```

## Key Test Files

| File | Purpose |
|------|---------|
| `session-lifecycle.js` | Complete user flow (auth → session → answers) |
| `connection-stability.js` | Resilience & reconnection handling |
| `config.js` | Test scenarios and thresholds |
| `run-tests.sh` | Convenient test runner script |

## Troubleshooting

### k6: command not found
```bash
# Install k6
brew install k6

# Or use Docker
alias k6='docker run --rm -v $PWD:/scripts grafana/k6'
```

### Tests fail with connection errors
- Ensure `npm run dev` is running
- Check BASE_URL is correct: `http://localhost:3000`
- Check for firewall/proxy issues

### Out of memory with high VU
- Run on a machine with more RAM
- Or reduce VU count: `k6 run --vus 50 --duration 60s`
- Or use cloud k6: https://cloud.k6.io

## Next Steps

1. ✅ Baseline your app with smoke + load tests
2. ✅ Identify bottlenecks
3. ✅ Set up CI/CD to run smoke tests on every PR
4. ✅ Monitor performance over time
5. ✅ Share results with team (results are in `results/` directory)

## Need Help?

- **k6 documentation:** https://k6.io/docs
- **Common issues:** See `README.md` troubleshooting section
- **Performance questions:** Check `config.js` for threshold definitions
