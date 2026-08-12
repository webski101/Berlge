/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'

import { createAdrInput, createRealtimeDecision } from '../app/decisionModel.ts'
import { preparedRealtimeDecision } from '../data/benchmarkFixtures.ts'
import { generateAdrMarkdown, type AdrInput } from './adr.ts'

const input = createAdrInput(createRealtimeDecision(500), '2026-08-12')

test('generates ADR deterministically from explicit evidence', () => {
  assert.equal(generateAdrMarkdown(input), generateAdrMarkdown(input))
})

test('ADR contains provenance, environment, sample count, configuration, and disclaimer', () => {
  const markdown = generateAdrMarkdown(input)
  assert.match(markdown, /## Evidence provenance/)
  assert.match(markdown, /Prepared demonstration evidence/)
  assert.match(markdown, /Sample count per transport:\*\* 10/)
  assert.match(markdown, /deliveryCadenceMs=150/)
  assert.match(markdown, /Prepared fixture; no live environment/)
  assert.match(markdown, /not a live run or universal protocol performance claims/)
  assert.match(markdown, /Measured p95 latency/)
  assert.match(markdown, /Declared complexity/)
  assert.match(markdown, /\*\*Winner:\*\* Server-Sent Events/)
  assert.match(markdown, /p95 latency must be at most 500 ms/)
})

test('escapes metadata and evidence table cells', () => {
  const escaped: AdrInput = {
    ...input,
    evidenceMetadata: {
      ...input.evidenceMetadata,
      configurations: { sse: { mode: 'one | two' } },
    },
    evaluations: [{ ...input.evaluations[1], name: 'SSE | stream' }],
    result: { winnerId: 'sse', rationale: ['Explicit evidence selects SSE.'] },
  }
  const markdown = generateAdrMarkdown(escaped)
  assert.match(markdown, /one \\| two/)
  assert.match(markdown, /SSE \\| stream/)
})

test('prepared evidence supports the intended eligibility outcomes without hard-coded winners', () => {
  const eligibleAt = (limit: number) => preparedRealtimeDecision.candidates
    .filter(({ benchmark }) => benchmark.deliveriesFailed === 0 && benchmark.p95LatencyMs <= limit)
    .map(({ id }) => id)
  assert.deepEqual(eligibleAt(500), ['sse', 'websockets'])
  assert.deepEqual(eligibleAt(100), ['websockets'])
})
