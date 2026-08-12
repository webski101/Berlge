/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'

import { preparedRealtimeDecision } from '../data/index.ts'
import { createRealtimeDecision } from './decisionModel.ts'
import { ingestBenchmarkEvidence, getPreparedFallback } from './evidence.ts'

const report = {
  schemaVersion: 1,
  provenance: { kind: 'live', label: 'Live local benchmark', evidenceSource: 'Local source' },
  timestamp: '2026-08-12T10:00:00.000Z',
  sampleCount: 2,
  environment: { nodeVersion: 'v24.0.0', os: 'test os' },
  configuration: {
    polling: { deliveryCadenceMs: 600 },
    sse: { deliveryCadenceMs: 150 },
    websockets: { deliveryCadenceMs: 20 },
  },
  candidates: [
    { id: 'polling', name: 'HTTP Polling', description: 'Poll', measurements: { deliveries: { successful: 2, failed: 0, total: 2 }, p95LatencyMs: 610, recoveryTimeMs: 610, implementationLines: 60 }, declared: { complexity: 2 } },
    { id: 'sse', name: 'Server-Sent Events', description: 'Stream', measurements: { deliveries: { successful: 2, failed: 0, total: 2 }, p95LatencyMs: 160, recoveryTimeMs: 260, implementationLines: 90 }, declared: { complexity: 3 } },
    { id: 'websockets', name: 'WebSockets', description: 'Socket', measurements: { deliveries: { successful: 2, failed: 0, total: 2 }, p95LatencyMs: 30, recoveryTimeMs: 410, implementationLines: 110 }, declared: { complexity: 7 } },
  ],
  disclaimer: 'Included implementations only.',
}

test('ingests validated evidence while preserving live provenance', () => {
  const evidence = ingestBenchmarkEvidence(report)
  assert.equal(evidence.provenance.label, 'Live local benchmark')
  assert.equal(evidence.candidates[1].benchmark.p95LatencyMs, 160)
  assert.equal(evidence.sampleCount, 2)
  assert.equal(createRealtimeDecision(500, evidence).result.winnerId, 'sse')
  assert.equal(createRealtimeDecision(100, evidence).result.winnerId, 'websockets')
})

test('prepared fallback remains explicitly prepared and is never relabeled live', () => {
  const fallback = getPreparedFallback()
  assert.equal(fallback, preparedRealtimeDecision)
  assert.equal(fallback.provenance.kind, 'prepared')
  assert.equal(fallback.provenance.label, 'Prepared demonstration evidence')
})

test('ingestion rejects unvalidated evidence', () => {
  assert.throws(() => ingestBenchmarkEvidence({ ...report, timestamp: 'not-a-date' }), /timestamp/)
})


