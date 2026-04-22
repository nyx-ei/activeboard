## Ticket #99 — Dashboard perf closeout note

### What is closed

`#99` is considered closed on the optimization side.

The implemented changes are:

- dashboard reads are split by route intent instead of one broad loader
- heavy performance analytics are read from a materialized view instead of being recomputed on every dashboard render
- dashboard reads that could still run independently are parallelized
- expensive dashboard/group navigations are bounded with `prefetch={false}` to avoid wasted SSR work on hover-aborted requests
- session-end now refreshes the materialized analytics source used by the Performance view

### Server-Timing limitation

The original ticket asked for `Server-Timing` headers visible in production on the dashboard route.

This is not fully implemented in the current App Router shape because the dashboard is rendered as an authenticated RSC page, and response headers are not directly mutable from the server component itself. We already capture structured internal timings in app logs through the perf tracker, but we do not currently emit a production `Server-Timing` response header from the dashboard page.

### Practical decision

We are closing `#99` for the real optimization work:

- heavy read-path cost has been reduced materially
- expensive prefetch waste has been bounded
- the broad dashboard SSR bottleneck has been narrowed

The remaining `Server-Timing` requirement is documented as an architectural limitation of the current route shape rather than left implicit.
