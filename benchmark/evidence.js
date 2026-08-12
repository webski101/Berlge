const candidateIds = ['polling', 'sse', 'websockets']

function assert(condition, message) {
  if (!condition) throw new TypeError(`Invalid benchmark evidence: ${message}`)
}

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** Validates untrusted benchmark JSON and returns it unchanged when valid. */
export function validateEvidence(value) {
  assert(value && typeof value === 'object', 'report must be an object')
  assert(value.schemaVersion === 1, 'schemaVersion must be 1')
  assert(value.provenance?.kind === 'live' || value.provenance?.kind === 'prepared', 'provenance kind is required')
  assert(typeof value.provenance?.label === 'string', 'provenance label is required')
  assert(typeof value.provenance?.evidenceSource === 'string', 'evidence source is required')
  assert(!Number.isNaN(Date.parse(value.timestamp)), 'timestamp must be ISO-compatible')
  assert(Number.isInteger(value.sampleCount) && value.sampleCount > 1, 'sampleCount must be an integer greater than one')
  assert(typeof value.environment?.nodeVersion === 'string', 'Node version is required')
  assert(typeof value.environment?.os === 'string', 'OS is required')
  assert(value.configuration && typeof value.configuration === 'object', 'configuration is required')
  assert(Array.isArray(value.candidates) && value.candidates.length === 3, 'exactly three candidates are required')
  assert(typeof value.disclaimer === 'string' && value.disclaimer.length > 0, 'disclaimer is required')

  for (const id of candidateIds) {
    const candidate = value.candidates.find((item) => item?.id === id)
    assert(candidate, `${id} candidate is required`)
    assert(typeof candidate.name === 'string' && typeof candidate.description === 'string', `${id} identity is invalid`)
    const measurements = candidate.measurements
    assert(measurements && typeof measurements === 'object', `${id} measurements are required`)
    const deliveries = measurements.deliveries
    assert(Number.isInteger(deliveries?.successful) && deliveries.successful >= 0, `${id} successful deliveries are invalid`)
    assert(Number.isInteger(deliveries?.failed) && deliveries.failed >= 0, `${id} failed deliveries are invalid`)
    assert(deliveries?.total === value.sampleCount, `${id} delivery total must equal sampleCount`)
    assert(deliveries.successful + deliveries.failed === deliveries.total, `${id} delivery counts do not balance`)
    for (const metric of ['p95LatencyMs', 'recoveryTimeMs', 'implementationLines']) {
      assert(finiteNonNegative(measurements[metric]), `${id} ${metric} is invalid`)
    }
    assert(Number.isInteger(measurements.implementationLines), `${id} implementationLines must be an integer`)
    assert(finiteNonNegative(candidate.declared?.complexity), `${id} declared complexity is invalid`)
    assert(value.configuration[id] && typeof value.configuration[id] === 'object', `${id} configuration is required`)
  }
  return value
}

export { candidateIds }

