# Berlge

Berlge is a local, deterministic architecture decision workbench. The demo compares Polling, Server-Sent Events, and WebSockets against prepared benchmark evidence, a hard p95-latency constraint, and explicit preference weights.

At the prepared 500 ms limit, Server-Sent Events wins. Tightening the limit to 100 ms excludes SSE and makes WebSockets the only eligible option. The complete result can be copied or downloaded as a Markdown architecture decision record.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

## Verify

```bash
npm test
npm run lint
npm run build
```

The project has no backend, database, authentication, external AI API, or network dependency at runtime.
