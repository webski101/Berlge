/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'

import { scoreDecision } from './scoring.ts'
import type { Candidate, DecisionInput } from './types.ts'

const candidates = [
  {
    id: 'polling',
    name: 'Polling',
    metrics: {
      deliveries: { successful: 20, failed: 0, total: 20 },
      p95LatencyMs: 450,
      reconnectTimeMs: 1_000,
      implementationSizeLines: 70,
      complexity: 1,
    },
  },
  {
    id: 'sse',
    name: 'SSE',
    metrics: {
      deliveries: { successful: 20, failed: 0, total: 20 },
      p95LatencyMs: 300,
      reconnectTimeMs: 300,
      implementationSizeLines: 80,
      complexity: 2,
    },
  },
  {
    id: 'websocket',
    name: 'WebSockets',
    metrics: {
      deliveries: { successful: 20, failed: 0, total: 20 },
      p95LatencyMs: 80,
      reconnectTimeMs: 120,
      implementationSizeLines: 180,
      complexity: 4,
    },
  },
] as const satisfies readonly Candidate[]

function decision(maximumP95LatencyMs: number): DecisionInput {
  return {
    candidates,
    hardRequirements: {
      maximumP95LatencyMs,
      requireAllDeliveriesSucceed: true,
    },
    weightedPreferences: {
      p95LatencyMs: 2,
      reconnectTimeMs: 1,
      implementationSizeLines: 4,
      complexity: 3,
    },
  }
}

function evaluationFor(result: ReturnType<typeof scoreDecision>, id: string) {
  const evaluation = result.evaluations.find((item) => item.candidateId === id)
  assert.ok(evaluation, `missing evaluation for ${id}`)
  return evaluation
}

test('identical input produces an identical result', () => {
  const input = decision(500)

  assert.deepEqual(scoreDecision(input), scoreDecision(input))
})

test('hard-constraint violations are surfaced and make candidates ineligible', () => {
  const input: DecisionInput = {
    candidates: [
      {
        ...candidates[0],
        metrics: {
          ...candidates[0].metrics,
          deliveries: { successful: 19, failed: 1, total: 20 },
          p95LatencyMs: 501,
        },
      },
    ],
    hardRequirements: {
      maximumP95LatencyMs: 500,
      requireAllDeliveriesSucceed: true,
    },
    weightedPreferences: decision(500).weightedPreferences,
  }

  const result = scoreDecision(input)
  const evaluation = evaluationFor(result, 'polling')

  assert.equal(evaluation.eligible, false)
  assert.deepEqual(
    evaluation.violations.map((violation) => violation.code),
    ['p95-latency-exceeded', 'required-deliveries-failed'],
  )
  assert.equal(result.winnerId, null)
  assert.match(result.explanation, /501 ms p95 exceeds/)
  assert.match(result.explanation, /1\/20 deliveries failed/)
})

test('SSE wins at 500 ms because size and simplicity outweigh WebSocket speed', () => {
  const result = scoreDecision(decision(500))
  const sse = evaluationFor(result, 'sse')
  const websocket = evaluationFor(result, 'websocket')

  assert.equal(sse.eligible, true)
  assert.equal(websocket.eligible, true)
  assert.equal(result.winnerId, 'sse')
  assert.ok(
    sse.normalizedMetrics.implementationSizeLines >
      websocket.normalizedMetrics.implementationSizeLines,
  )
  assert.ok(sse.normalizedMetrics.complexity > websocket.normalizedMetrics.complexity)
  assert.ok(sse.weightedPreferenceScore > websocket.weightedPreferenceScore)
  assert.match(result.explanation, /80 measured lines, declared complexity 2/)
})

test('changing only maximum latency to 100 ms makes WebSockets win', () => {
  const original = decision(500)
  const strict: DecisionInput = {
    ...original,
    hardRequirements: {
      ...original.hardRequirements,
      maximumP95LatencyMs: 100,
    },
  }

  const result = scoreDecision(strict)

  assert.equal(result.winnerId, 'websocket')
  assert.equal(evaluationFor(result, 'sse').eligible, false)
  assert.deepEqual(
    evaluationFor(result, 'sse').violations.map((violation) => violation.code),
    ['p95-latency-exceeded'],
  )
  assert.equal(evaluationFor(result, 'websocket').eligible, true)
})

test('delivery-count and weight edge cases stay finite, deterministic, and immutable', () => {
  const input: DecisionInput = {
    candidates: [
      {
        id: 'zeta',
        name: 'Zeta',
        metrics: {
          deliveries: { successful: 1, failed: 0, total: 1 },
          p95LatencyMs: 10,
          reconnectTimeMs: 10,
          implementationSizeLines: 10,
          complexity: 1,
        },
      },
      {
        id: 'alpha',
        name: 'Alpha',
        metrics: {
          deliveries: { successful: 1, failed: 0, total: 1 },
          p95LatencyMs: 10,
          reconnectTimeMs: 10,
          implementationSizeLines: 10,
          complexity: 1,
        },
      },
      {
        id: 'no-deliveries',
        name: 'No deliveries',
        metrics: {
          deliveries: { successful: 0, failed: 0, total: 0 },
          p95LatencyMs: 10,
          reconnectTimeMs: 10,
          implementationSizeLines: 10,
          complexity: 1,
        },
      },
    ],
    hardRequirements: {
      maximumP95LatencyMs: 100,
      requireAllDeliveriesSucceed: true,
    },
    weightedPreferences: {
      p95LatencyMs: 0,
      reconnectTimeMs: -1,
      implementationSizeLines: Number.NaN,
      complexity: Number.POSITIVE_INFINITY,
    },
  }
  const snapshot = structuredClone(input)

  const result = scoreDecision(input)

  assert.deepEqual(input, snapshot)
  assert.deepEqual(result.normalizedWeights, {
    p95LatencyMs: 0,
    reconnectTimeMs: 0,
    implementationSizeLines: 0,
    complexity: 0,
  })
  assert.equal(result.winnerId, 'alpha')
  assert.equal(evaluationFor(result, 'no-deliveries').eligible, false)
  assert.equal(
    evaluationFor(result, 'no-deliveries').violations[0]?.code,
    'invalid-benchmark',
  )

  for (const evaluation of result.evaluations) {
    assert.equal(Number.isFinite(evaluation.weightedPreferenceScore), true)
    for (const score of Object.values(evaluation.normalizedMetrics)) {
      assert.equal(Number.isFinite(score), true)
    }
  }
})
