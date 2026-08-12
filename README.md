# Berlge

Berlge is a local-first architecture decision workbench. This MVP compares the
three **included** browser-delivery implementations—HTTP Polling, Server-Sent
Events (SSE), and WebSockets—then feeds their evidence into a deterministic
TypeScript scorer and exports a Markdown ADR.

Results are measurements of these small loopback implementations and their
documented settings. They are **not universal protocol-performance claims**.

## What the experiment does

`benchmark/runner.js` is the single benchmark implementation used by both the CLI
and dashboard. It:

- starts each transport on an operating-system-assigned temporary port;
- sends multiple real events and records successful/failed deliveries;
- measures nearest-rank p95 delivery latency and a forced-failure recovery probe;
- counts nonblank, non-comment lines in each transport source file;
- records ISO timestamp, samples per transport, Node version, OS, configuration,
  evidence source, and provenance;
- validates the resulting JSON; and
- closes streams, sockets, timers, and servers in `finally` blocks.

The fixed local configurations are:

| Included implementation | Delivery cadence | Recovery behavior |
| --- | ---: | --- |
| HTTP Polling | 600 ms | one forced HTTP 503, then retry at the next 600 ms poll |
| SSE | 150 ms server flush | server closes stream; client reconnects after 250 ms |
| WebSockets | 20 ms server flush | server closes socket; application reconnects after 400 ms |

These settings are chosen so SSE should ordinarily satisfy the 500 ms control,
while the included WebSocket is ordinarily the option satisfying 100 ms. The
winner is never hard-coded: observed deliveries and latency are passed to the
same scorer after each run.

### Measured, configured, declared, and prepared

- **Measured:** deliveries, p95 latency, recovery time, and relevant
  implementation source lines.
- **Configured:** delivery cadence, retry/reconnect delay, and recovery trigger.
- **Declared:** complexity is a human-defined ordinal factor (2 Polling, 3 SSE,
  7 WebSockets), not a measurement.
- **Prepared:** the initial checked-in evidence is a demonstration fixture. It is
  labeled **Prepared demonstration evidence** everywhere and is never presented
  as a live result.

## Run locally

Requires Node.js `>=22.12.0` and npm (the included client uses Node's built-in
WebSocket implementation).

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. Select **Run experiment** to call the development
server's local-only `POST /api/benchmark` route. While work is running the button
is disabled and the dashboard reports that real loopback events are being sent.
Successful results are labeled **Live local benchmark** with their timestamp,
sample count, runtime, OS, source, and configuration.

The endpoint is intentionally supplied by the Vite development server and is not
part of the static production bundle. It accepts only `POST` and makes no external
network, API, AI, database, cloud, or authentication call.

If the live run fails, Berlge displays the error without relabeling the current
evidence. The user may retry **Run experiment** or intentionally choose **Use
prepared demonstration evidence**. Fixture fallback is never automatic.

## Run the benchmark directly

```bash
npm run benchmark
```

The command writes validated JSON to stdout. Default sample count is 10 per
transport. Because measurements use real local timers, exact values vary by host
load, Node version, operating system, and scheduler.

## Decision model

Hard requirements gate candidates before ranking:

1. every benchmark delivery must succeed; and
2. measured p95 latency must not exceed the active 500 ms or 100 ms control.

For visible comparison, lower-is-better values are min-max normalized. Weights
are p95 latency 15%, recovery 15%, implementation lines 35%, and declared
complexity 35%. Eligible ties are resolved by candidate ID, keeping scoring
deterministic for identical evidence and constraints.

The ADR contains provenance, evidence source, measurement timestamp, environment,
sample count, transport configurations, included-implementation disclaimer,
measured values, declared factors, constraints, scores, recommendation, and
rationale.

## Verification

```bash
npm test
npm run lint
npm run build
npm run benchmark
```

Tests cover p95, schema validation and ingestion, provenance, intentional
fallback, deterministic scoring, ADR metadata, and temporary-server cleanup.

## Local-MVP limitations

- Loopback timing does not model internet latency, proxies, TLS, packet loss,
  browser throttling, mobile radios, load balancers, or production concurrency.
- Recovery is a repeatable synthetic disconnect, not a complete outage study.
- The WebSocket implementation is deliberately minimal: small text frames only,
  with no fragmentation, extensions, authentication, or production hardening.
- SSE parsing and Polling queues are likewise benchmark fixtures, not reusable
  production libraries.
- Source-line counts depend on the documented counter and are not maintenance-cost
  measurements.
- Complexity remains declared human judgment.
- Production `vite build` is static; live benchmarking requires `npm run dev` or
  the CLI runner.

## Project layout

```text
benchmark/
  evidence.js                 validated report schema
  runner.js                   shared orchestrator and p95/line counting
  transports/                 included Polling, SSE, and WebSocket implementations
  vitePlugin.js               local POST /api/benchmark adapter
src/
  app/                        evidence ingestion and decision-model adapter
  domain/                     deterministic scorer
  data/                       prepared demonstration evidence
  lib/                        ADR generation
  components/ + styles/       existing dashboard presentation
```
