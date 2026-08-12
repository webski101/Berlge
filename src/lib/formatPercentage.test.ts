import assert from 'node:assert/strict'
import test from 'node:test'

import { formatPercentage } from './formatPercentage.ts'

test('formats percentages without floating-point artifacts', () => {
  assert.equal(formatPercentage(0.1 + 0.05), '15%')
  assert.equal(formatPercentage(0.125), '12.5%')
})
