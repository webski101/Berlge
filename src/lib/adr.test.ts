/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'

import { preparedRealtimeDecision } from '../data/benchmarkFixtures.ts'
import { generateAdrMarkdown, type AdrInput } from './adr.ts'

const adrInput = {
  decision: {
    title: 'Real-time delivery transport',
    status: 'Accepted',
    date: '2026-08-12',
    context: 'The browser needs prompt one-way updates without avoidable operational cost.',
    question: 'Which transport should carry MVP updates?',
  },
  hardRequirements: [
    {
      id: 'tests',
      label: 'Test suite',
      description: 'All 36 prepared tests must pass.',
    },
    {
      id: 'latency',
      label: 'Latency ceiling',
      description: 'p95 latency must not exceed 500 ms.',
    },
  ],
  weightedPreferences: [
    {
      id: 'implementation',
      label: 'Implementation size',
      weight: 0.6,
      description: 'Prefer fewer application lines.',
    },
    {
      id: 'complexity',
      label: 'Complexity',
      weight: 0.4,
      description: 'Prefer a smaller complexity rating.',
    },
  ],
  evaluations: [
    {
      id: 'polling',
      name: 'Polling',
      description: 'Periodic HTTP requests.',
      evidence: {
        testsPassed: 36,
        testsTotal: 36,
        p95LatencyMs: 820,
        reconnectMs: 1050,
        implementationLines: 54,
        complexity: 2,
      },
      eligible: false,
      weightedScore: null,
      violations: ['p95 latency 820 ms exceeds the 500 ms ceiling'],
    },
    {
      id: 'sse',
      name: 'Server-Sent Events',
      description: 'A one-way HTTP event stream.',
      evidence: {
        testsPassed: 36,
        testsTotal: 36,
        p95LatencyMs: 180,
        reconnectMs: 340,
        implementationLines: 82,
        complexity: 3,
      },
      eligible: true,
      weightedScore: 0.91,
      violations: [],
    },
    {
      id: 'websockets',
      name: 'WebSockets',
      description: 'A bidirectional persistent socket.',
      evidence: {
        testsPassed: 36,
        testsTotal: 36,
        p95LatencyMs: 72,
        reconnectMs: 510,
        implementationLines: 156,
        complexity: 7,
      },
      eligible: true,
      weightedScore: 0.64,
      violations: [],
    },
  ],
  result: {
    winnerId: 'sse',
    rationale: [
      'Polling is excluded by the hard latency requirement.',
      'SSE has the strongest supplied weighted score among eligible options.',
    ],
  },
  reproducibilityNote:
    'Generated from the checked-in local fixture and precomputed deterministic evaluations; no network services or ambient time were used.',
} as const satisfies AdrInput

const expectedMarkdown = `# Real-time delivery transport

- **Status:** Accepted
- **Date:** 2026-08-12

## Context

The browser needs prompt one-way updates without avoidable operational cost.

**Architecture question:** Which transport should carry MVP updates?

## Hard requirements

- **Test suite:** All 36 prepared tests must pass.
- **Latency ceiling:** p95 latency must not exceed 500 ms.

## Weighted preferences

| Preference | Weight | Description |
| --- | ---: | --- |
| Implementation size | 60% | Prefer fewer application lines. |
| Complexity | 40% | Prefer a smaller complexity rating. |

## Options considered

- **Polling:** Periodic HTTP requests.
- **Server-Sent Events:** A one-way HTTP event stream.
- **WebSockets:** A bidirectional persistent socket.

## Evidence comparison

| Option | Tests | p95 latency (ms) | Reconnect (ms) | Implementation lines | Complexity | Eligible | Weighted score |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Polling | 36/36 | 820 | 1050 | 54 | 2 | No | — |
| Server-Sent Events | 36/36 | 180 | 340 | 82 | 3 | Yes | 0.91 |
| WebSockets | 36/36 | 72 | 510 | 156 | 7 | Yes | 0.64 |

## Constraint violations

- **Polling:** p95 latency 820 ms exceeds the 500 ms ceiling
- **Server-Sent Events:** None.
- **WebSockets:** None.

## Decision

**Winner:** Server-Sent Events

### Rationale

- Polling is excluded by the hard latency requirement.
- SSE has the strongest supplied weighted score among eligible options.

## Reproducibility

Generated from the checked-in local fixture and precomputed deterministic evaluations; no network services or ambient time were used.
`

test('generates the complete ADR deterministically from explicit input', () => {
  const first = generateAdrMarkdown(adrInput)
  const second = generateAdrMarkdown(adrInput)

  assert.equal(first, expectedMarkdown)
  assert.equal(second, first)
})

test('includes required sections, the supplied date, winner, and violations', () => {
  const markdown = generateAdrMarkdown(adrInput)

  for (const heading of [
    '## Context',
    '## Hard requirements',
    '## Weighted preferences',
    '## Options considered',
    '## Evidence comparison',
    '## Constraint violations',
    '## Decision',
    '## Reproducibility',
  ]) {
    assert.match(markdown, new RegExp(`^${heading}`, 'm'))
  }

  assert.match(markdown, /\*\*Date:\*\* 2026-08-12/)
  assert.match(markdown, /\*\*Winner:\*\* Server-Sent Events/)
  assert.match(markdown, /Polling:\*\* p95 latency 820 ms exceeds/)
  assert.match(markdown, /\| Option \| Tests \| p95 latency \(ms\) \|/)
})

test('escapes Markdown table cells and normalizes embedded newlines', () => {
  const escapedInput: AdrInput = {
    ...adrInput,
    weightedPreferences: [
      {
        id: 'escape',
        label: 'Ops | safety',
        weight: 25,
        description: 'Avoid <scripts> & `surprises`\non deploy.',
      },
    ],
    evaluations: [
      {
        ...adrInput.evaluations[1],
        name: 'SSE | stream',
      },
    ],
    result: {
      winnerId: 'sse',
      rationale: ['The supplied evaluation selects SSE.'],
    },
  }

  const markdown = generateAdrMarkdown(escapedInput)

  assert.match(
    markdown,
    /\| Ops \\\| safety \| 25% \| Avoid &lt;scripts&gt; &amp; \\`surprises\\`<br>on deploy\. \|/,
  )
  assert.match(markdown, /\| SSE \\\| stream \| 36\/36 \|/)
})

test('prepared fixture encodes the two intended latency eligibility outcomes', () => {
  assert.equal(preparedRealtimeDecision.candidates.length, 3)

  const eligibleAt500 = preparedRealtimeDecision.candidates
    .filter(
      ({ benchmark }) =>
        benchmark.testsPassed === benchmark.testsTotal &&
        benchmark.p95LatencyMs <= 500,
    )
    .map(({ id }) => id)
  const eligibleAt100 = preparedRealtimeDecision.candidates
    .filter(
      ({ benchmark }) =>
        benchmark.testsPassed === benchmark.testsTotal &&
        benchmark.p95LatencyMs <= 100,
    )
    .map(({ id }) => id)

  assert.deepEqual(eligibleAt500, ['sse', 'websockets'])
  assert.deepEqual(eligibleAt100, ['websockets'])
  assert.ok(
    preparedRealtimeDecision.candidates[1].benchmark.implementationLines <
      preparedRealtimeDecision.candidates[2].benchmark.implementationLines,
  )
  assert.ok(
    preparedRealtimeDecision.candidates[1].benchmark.complexity <
      preparedRealtimeDecision.candidates[2].benchmark.complexity,
  )
})
