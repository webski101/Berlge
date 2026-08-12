import assert from 'node:assert/strict'
import test from 'node:test'

import { generateAdrMarkdown } from '../lib/index.ts'
import {
  createAdrInput,
  createRealtimeDecision,
  decisionReasons,
} from './decisionModel.ts'

test('integrated model recommends SSE at the prepared 500 ms constraint', () => {
  const model = createRealtimeDecision(500)

  assert.equal(model.result.winnerId, 'sse')
  assert.equal(model.winner?.name, 'Server-Sent Events')
  assert.match(decisionReasons(model).join(' '), /0\.812 preference score/)
})

test('integrated model recommends WebSockets when the constraint is 100 ms', () => {
  const model = createRealtimeDecision(100)

  assert.equal(model.result.winnerId, 'websockets')
  assert.deepEqual(
    model.result.evaluations
      .filter((evaluation) => !evaluation.eligible)
      .map((evaluation) => evaluation.candidateId),
    ['polling', 'sse'],
  )
  assert.match(decisionReasons(model).join(' '), /only eligible option/)
})

test('integrated ADR contains the live threshold, winner, and violations', () => {
  const model = createRealtimeDecision(100)
  const markdown = generateAdrMarkdown(
    createAdrInput(model, '2026-08-12'),
  )

  assert.match(markdown, /\*\*Winner:\*\* WebSockets/)
  assert.match(markdown, /p95 latency must be at most 100 ms/)
  assert.match(markdown, /Server-Sent Events: 180 ms p95 exceeds the 100 ms maximum/)
})
