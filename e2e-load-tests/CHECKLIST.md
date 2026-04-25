# Load Testing Setup Checklist

## ✅ Setup Complete

- [x] k6 test scripts created
  - [x] `session-lifecycle.js` — User flow simulation
  - [x] `connection-stability.js` — Resilience testing
  - [x] `config.js` — Scenario & threshold definitions

- [x] Thresholds configured
  - [x] Aggressive SLA: p95 < 500ms, p99 < 1s, errors < 1%
  - [x] Consistent thresholds across all scenarios (smoke/load/stress/spike)
  - [x] Documented in `THRESHOLDS.md`

- [x] Documentation created
  - [x] `README.md` — Comprehensive guide
  - [x] `QUICKSTART.md` — Fast start
  - [x] `THRESHOLDS.md` — Performance targets & diagnostics

- [x] Convenience scripts
  - [x] `run-tests.sh` — Test runner with logging
  - [x] npm scripts for easy access:
    - `npm run test:load:smoke`
    - `npm run test:load:load`
    - `npm run test:load:stress`
    - `npm run test:load:spike`
    - `npm run test:load:stability`

- [x] Docker support
  - [x] `Dockerfile` — Run tests without k6 install

---

## 📋 Next: Your To-Do List

### Phase 1: Installation & Validation (Now)
- [ ] Install k6: `brew install k6` (or `docker build -t activeboard-load-tests .`)
- [ ] Verify: `k6 version`
- [ ] Start dev server: `npm run dev`
- [ ] Run smoke test: `npm run test:load:smoke`

### Phase 2: Establish Baseline (This week)
- [ ] Run all scenarios and record results:
  - [ ] `npm run test:load:smoke`
  - [ ] `npm run test:load:load`
  - [ ] `npm run test:load:stress`
  - [ ] `npm run test:load:spike`
- [ ] Document baseline performance in `THRESHOLDS.md` results table
- [ ] Identify any failing thresholds (if any)

### Phase 3: Fix Regressions (If needed)
- [ ] If tests fail, diagnose using `THRESHOLDS.md` troubleshooting
- [ ] Profile bottlenecks (database, API, infrastructure)
- [ ] Implement fixes one at a time
- [ ] Re-test after each fix to validate improvement

### Phase 4: CI/CD Integration (Optional but recommended)
- [ ] Add smoke test to GitHub Actions on every PR
- [ ] Add nightly full test suite run
- [ ] Set up performance regression alerts
- [ ] Archive results for trend analysis

### Phase 5: Monitoring & Optimization (Ongoing)
- [ ] Run tests weekly/monthly to track performance over time
- [ ] Set alerts when thresholds approach limits
- [ ] Use results to guide scaling decisions
- [ ] Share metrics with team

---

## 🎯 Success Criteria

Your load testing is **successful** when:

- ✓ All tests run without errors
- ✓ Smoke test passes consistently (< 2 min)
- ✓ Load test with 100 VUs maintains < 500ms p95 latency
- ✓ Stress test with 500 VUs maintains < 500ms p95 latency (or identifies scaling bottleneck)
- ✓ Error rate stays below 1% across all scenarios
- ✓ Results are reproducible (same metrics on re-runs)

---

## 🚀 Commands Reference

```bash
# Installation
brew install k6

# Start development
npm run dev

# Run tests
npm run test:load:smoke      # 2 min, 5 users
npm run test:load:load       # 5 min, 100 users
npm run test:load:stress     # 10 min, 500 users
npm run test:load:spike      # 3 min, sudden 200 users
npm run test:load:stability  # 5 min, resilience testing

# View results
ls -la e2e-load-tests/results/

# View specific result
cat e2e-load-tests/results/session-lifecycle_load_YYYYMMDD_HHMMSS/output.log
```

---

## 📊 Threshold Summary

**Your Configuration:**

| Metric | Target |
|--------|--------|
| p95 Latency | < 500ms |
| p99 Latency | < 1000ms |
| Error Rate | < 1% |
| Strategy | Same SLAs everywhere |

**Location:** `e2e-load-tests/config.js` (update `thresholds` object to adjust)

---

## 📚 Documentation Map

| Document | Purpose |
|----------|---------|
| `README.md` | Complete reference—all features & troubleshooting |
| `QUICKSTART.md` | 5-minute fast start |
| `THRESHOLDS.md` | Performance targets, diagnostics, optimization workflow |
| `CHECKLIST.md` | This file—progress tracking |
| `config.js` | Test scenarios and threshold configuration |

---

## 🤔 FAQ

**Q: Do I need to modify test scripts?**  
A: Not unless your API routes change. Adjust `BASE_URL` and auth flow if needed.

**Q: Can I run from cloud (not localhost)?**  
A: Yes! `k6 run -e BASE_URL=https://staging.activeboard.app ...`

**Q: What if tests fail immediately?**  
A: Check:
1. `npm run dev` is running on `http://localhost:3000`
2. k6 is installed: `k6 version`
3. No firewall blocking port 3000

**Q: How do I interpret results?**  
A: See `THRESHOLDS.md` section "Reading Test Results"

**Q: Should I run all scenarios every time?**  
A: Smoke test for fast feedback (2 min). Full suite weekly.

---

## 💡 Performance Optimization Tips

1. **Start small:** Run smoke test first (5 VUs, 2 min)
2. **Establish baseline:** Record current performance
3. **Test one change:** Optimize, re-test, measure improvement
4. **Watch percentiles:** p99 matters more than average
5. **Profile under load:** Use CPU/memory tools during stress test
6. **Scale incrementally:** Fix bottleneck, then increase load

See `THRESHOLDS.md` for detailed optimization workflow.

---

## ✨ You're Ready!

Everything is set up. Next step: `npm run test:load:smoke` 🚀

Questions? Check:
- `QUICKSTART.md` for quick answers
- `THRESHOLDS.md` for performance details
- `README.md` for comprehensive reference
