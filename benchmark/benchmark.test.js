import assert from 'node:assert/strict'
import test from 'node:test'

import { activeServerCount } from './runtime.js'
import { validateEvidence } from './evidence.js'
import { percentile95, runBenchmark } from './runner.js'

test('p95 uses the nearest-rank definition without mutating samples', () => {
  const samples = Array.from({ length: 20 }, (_, index) => 20 - index)
  assert.equal(percentile95(samples), 19)
  assert.deepEqual(samples, Array.from({ length: 20 }, (_, index) => 20 - index))
  assert.throws(() => percentile95([]), /at least one/)
})

test('evidence validator accepts complete reports and rejects malformed delivery totals', async () => {
  const report = await runBenchmark({ sampleCount: 2 })
  assert.equal(validateEvidence(report), report)
  const malformed = structuredClone(report)
  malformed.candidates[0].measurements.deliveries.total = 99
  assert.throws(() => validateEvidence(malformed), /delivery total/)
})

test('runner records live provenance and cleans up every temporary server', async () => {
  const report = await runBenchmark({ sampleCount: 2 })
  assert.equal(report.provenance.kind, 'live')
  assert.equal(report.provenance.label, 'Live local benchmark')
  assert.equal(report.sampleCount, 2)
  assert.equal(activeServerCount(), 0)
  assert.match(report.disclaimer, /included local implementations/)
  for (const candidate of report.candidates) {
    assert.equal(candidate.measurements.deliveries.total, 2)
    assert.equal(candidate.measurements.implementationLines > 0, true)
  }
})

