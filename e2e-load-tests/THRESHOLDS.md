# Performance Thresholds & SLA

## Your Targets

**Profile:** Aggressive (Production-grade)  
**Updated:** 2026-04-24

### Threshold Configuration

All scenarios share the same SLA — your system must maintain aggressive performance even under peak load:

```
├─ p95 Latency: < 500ms  (95th percentile of all requests)
├─ p99 Latency: < 1000ms (99th percentile of all requests)  
└─ Error Rate:  < 1%     (failure rate across all requests)
```

### Why Same SLAs Everywhere?

| Scenario | VUs | Purpose | Why Same SLA? |
|----------|-----|---------|---------------|
| **Smoke** | 5 | Sanity check | Baseline—should be easiest |
| **Load** | 100 | Normal ops | Real-world load expected |
| **Stress** | 500 | Breaking point | Validate system resilience at 5x normal load |
| **Spike** | 200 | Sudden spike | Validate recovery from traffic shocks |

**Philosophy:** If your system can handle 500 concurrent users with < 500ms latency, you have a highly performant, scalable system. No degradation = no surprises.

---

## Reading Test Results

### Example: Passing Test ✅

```
✓ http_req_duration ......... : avg=245ms  p(95)=480ms  p(99)=890ms
✓ http_req_failed ........... : 0.5%
✓ sessions_created .......... : 150
✓ questions_answered ........ : 1500
```

**Status:** PASS  
**Interpretation:**
- 95% of requests < 480ms ✓ (threshold: 500ms)
- 99% of requests < 890ms ✓ (threshold: 1000ms)
- 0.5% errors ✓ (threshold: 1%)
- System maintains SLA under test load

---

### Example: Failing Test ❌

```
✗ http_req_duration ......... : avg=625ms  p(95)=950ms  p(99)=2100ms
✗ http_req_failed ........... : 2.3%
✓ sessions_created .......... : 120
```

**Status:** FAIL  
**Issues:**
- p95=950ms exceeds 500ms threshold by 90%
- p99=2100ms exceeds 1000ms threshold by 110%
- 2.3% error rate exceeds 1% threshold

**Next steps:** Profile → identify bottleneck → optimize

---

## Understanding Percentiles

```
Request completion times (sorted):
1    [100ms] ← 0th percentile (fastest)
...
950  [450ms] ← p50 (median)
...
1850 [480ms] ← p95 (95% of requests faster than this)
...
1950 [890ms] ← p99 (99% of requests faster than this)
...
2000 [5000ms] ← p100 (slowest outlier)

Thresholds check:
✓ p95 (480ms) < 500ms
✓ p99 (890ms) < 1000ms
```

### Why Not Use Averages?

**Bad:** "Average latency is 245ms" (hides 99th percentile problems)  
**Good:** "p95=480ms, p99=890ms" (shows real user experience)

High p99 means 1 in 100 users hit slow requests—matters for user perception.

---

## Performance Degradation Patterns

### Pattern 1: Linear Degradation
```
Smoke (5 VUs):   p95=200ms  p99=300ms  ✓ PASS
Load (100 VUs):  p95=450ms  p99=900ms  ✓ PASS
Stress (500 VUs):p95=500ms  p99=1000ms ✓ PASS (at edge)
```
**Interpretation:** Good scaling. System handles load linearly up to ~600 VUs.

### Pattern 2: Cliff at Saturation
```
Smoke (5 VUs):   p95=200ms  p99=300ms  ✓ PASS
Load (100 VUs):  p95=450ms  p99=900ms  ✓ PASS
Stress (500 VUs):p95=2000ms p99=5000ms ✗ FAIL
```
**Interpretation:** System breaks around 250-300 VUs. Bottleneck hits hard.

### Pattern 3: Gradual Degradation
```
Smoke (5 VUs):   p95=200ms  p99=300ms  ✓ PASS
Load (100 VUs):  p95=550ms  p99=1200ms ✗ FAIL (small sample)
Stress (500 VUs):p95=800ms  p99=2500ms ✗ FAIL
```
**Interpretation:** Insufficient capacity even at normal load. Scale up infrastructure.

---

## Diagnosing Failures

### High p95/p99 Latency

1. **Check database:**
   - Run slow query logs
   - Look for N+1 queries
   - Check indexes on frequently queried fields
   - Monitor connection pool saturation

2. **Check application:**
   - Review CPU/memory during test
   - Check for garbage collection pauses
   - Look for synchronous I/O in request path
   - Profile hot code paths with flamegraphs

3. **Check infrastructure:**
   - Network latency (ping edge → server)
   - Disk I/O (if storage-bound)
   - CDN cache hit rates
   - Third-party API dependencies

### High Error Rate

1. **Common causes:**
   - Database connection pool exhaustion (try increasing pool size)
   - Request timeout too aggressive (increase timeout)
   - Auth token expiration (extend session TTL)
   - Rate limiting triggered (disable for test or increase limits)

2. **Debugging:**
   ```bash
   # Run with verbose output
   k6 run --verbose session-lifecycle.js 2>&1 | grep -i error
   
   # Check application logs during test
   tail -f logs/application.log
   
   # Monitor server resources
   top  # or Activity Monitor on macOS
   ```

---

## Optimization Workflow

### Before You Optimize

Run baseline test and record results:
```bash
npm run test:load:load  # Get baseline numbers

# Save results
cp e2e-load-tests/results/session-lifecycle_load_* baseline-$(date +%s)/
```

### After Each Change

1. Commit code change
2. Run same test scenario
3. Compare results
4. Track improvements in THRESHOLDS.md (see Results Table below)

### Results Table Template

```markdown
| Date | Change | Scenario | p95 Before | p95 After | Impact | Status |
|------|--------|----------|-----------|-----------|--------|--------|
| 2026-04-24 | Baseline | Load | — | 625ms | — | FAIL |
| 2026-04-25 | Add session index | Load | 625ms | 480ms | -23% | PASS ✓ |
| 2026-04-26 | Cache queries | Load | 480ms | 320ms | -33% | PASS ✓ |
```

---

## Threshold Adjustment

You picked **Aggressive (p95 < 500ms, p99 < 1s)** with **< 1% errors** and **same SLAs everywhere**.

### If You Need to Relax Thresholds

**Edit `config.js`** (not recommended—start with optimization first):

```javascript
thresholds: {
  'http_req_duration': [
    'p(95)<750',    // ← Changed from 500
    'p(99)<1500',   // ← Changed from 1000
  ],
  'http_req_failed': ['rate<0.02'], // ← Changed from 0.01 (1%)
}
```

**Before relaxing, ask:**
- Is the bottleneck fixable? (usually yes)
- Will relaxed SLA affect user experience?
- Is this temporary or permanent?

---

## Real-World Context

Your thresholds match top-tier performance expectations:

| Company | p95 Target | p99 Target | Scale |
|---------|-----------|-----------|-------|
| **ActiveBoard (yours)** | < 500ms | < 1s | 500 concurrent |
| Google Search | < 100ms | < 200ms | millions |
| Stripe Payments | < 100ms | < 300ms | millions |
| Typical SaaS | 500-2000ms | 1-5s | thousands |

You're targeting performance more aggressive than typical SaaS—appropriate for a real-time collaborative app where timer sync and responsiveness matter.

---

## Questions?

- **How do I know what latency is "good"?** → Context matters. For a real-time exam timer, 500ms is aggressive. For batch processing, 5s is fine.
- **Should I test from cloud?** → Yes, after local validation. Network adds realistic latency.
- **How often should I run tests?** → Every PR (smoke test), nightly (full suite), before releases (all scenarios).
- **What about mobile clients?** → Consider network latency (100-300ms added). Your server SLA should leave room.
