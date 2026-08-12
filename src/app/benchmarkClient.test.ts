/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  describeBenchmarkError,
  getBenchmarkAvailability,
  HOSTED_DEMO_MESSAGE,
  LOCAL_BENCHMARK_INSTRUCTIONS,
  requestBenchmarkEvidence,
} from './benchmarkClient.ts'

const responseFrom = (body: string, status = 200, contentType = 'application/json') =>
  new Response(body, { status, headers: { 'content-type': contentType } })

test('keeps the genuine benchmark available in Vite development', () => {
  assert.deepEqual(getBenchmarkAvailability(true), { canRun: true, runLabel: 'Run experiment' })
})

test('disables the benchmark with an explanatory label in hosted builds', () => {
  assert.deepEqual(getBenchmarkAvailability(false), { canRun: false, runLabel: 'Local benchmark only' })
})

test('normalizes JSON error responses without displaying response data', async () => {
  await assert.rejects(
    requestBenchmarkEvidence(async () => responseFrom(JSON.stringify({ error: { reason: 'private detail' } }), 500)),
    (error: Error) => {
      assert.equal(error.message, 'The local benchmark endpoint reported an error (HTTP 500). Restart the Vite development server and try again.')
      assert.doesNotMatch(error.message, /\[object Object\]|private detail/)
      return true
    },
  )
})

test('normalizes failed HTTP responses without displaying the response body', async () => {
  await assert.rejects(
    requestBenchmarkEvidence(async () => responseFrom('upstream internal stack', 502, 'text/plain')),
    (error: Error) => {
      assert.equal(error.message, 'The local benchmark endpoint reported an error (HTTP 502). Restart the Vite development server and try again.')
      assert.doesNotMatch(error.message, /upstream internal stack/)
      return true
    },
  )
})

test('normalizes non-success HTML responses as an unavailable hosted endpoint', async () => {
  await assert.rejects(
    requestBenchmarkEvidence(async () => responseFrom('<!doctype html><title>Hosted app</title>', 404, 'text/html')),
    (error: Error) => {
      assert.match(error.message, new RegExp(HOSTED_DEMO_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.match(error.message, new RegExp(LOCAL_BENCHMARK_INSTRUCTIONS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.doesNotMatch(error.message, /<!doctype|Hosted app/)
      return true
    },
  )
})

test('normalizes successful HTML responses from a static fallback page', async () => {
  await assert.rejects(
    requestBenchmarkEvidence(async () => responseFrom('<html><body>Berlge</body></html>', 200, 'text/html')),
    (error: Error) => {
      assert.match(error.message, /returned the hosted page instead of benchmark evidence/)
      assert.match(error.message, /Live experiments run locally/)
      return true
    },
  )
})

test('normalizes network failures as local endpoint guidance', async () => {
  await assert.rejects(
    requestBenchmarkEvidence(async () => { throw new TypeError('Failed to fetch internal detail') }),
    (error: Error) => {
      assert.match(error.message, /could not be reached/)
      assert.match(error.message, /npm install, then npm run dev/)
      assert.doesNotMatch(error.message, /Failed to fetch internal detail/)
      return true
    },
  )
})

test('returns successful JSON evidence for the local flow', async () => {
  const evidence = await requestBenchmarkEvidence(async () => responseFrom('{"schemaVersion":1}'))
  assert.deepEqual(evidence, { schemaVersion: 1 })
})

test('normalizes unexpected thrown values instead of stringifying them', () => {
  const message = describeBenchmarkError({ error: { reason: 'private detail' } })
  assert.equal(message, 'The benchmark returned evidence Berlge could not validate. The current labeled evidence is unchanged.')
  assert.doesNotMatch(message, /\[object Object\]|private detail/)
})
