import { readFile } from 'node:fs/promises'
import { arch, platform, release } from 'node:os'
import { fileURLToPath } from 'node:url'

import { validateEvidence } from './evidence.js'
import { runPollingBenchmark, pollingConfiguration } from './transports/polling.js'
import { runSseBenchmark, sseConfiguration } from './transports/sse.js'
import { runWebsocketBenchmark, websocketConfiguration } from './transports/websockets.js'

export const DEFAULT_SAMPLE_COUNT = 10

export function percentile95(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError('p95 requires at least one numeric sample.')
  }
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError('p95 samples must be finite numbers.')
  }
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * 0.95) - 1]
}

async function countImplementationLines(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  return source.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim()
    return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')
  }).length
}

function rounded(value) {
  return Number(value.toFixed(2))
}

const definitions = [
  {
    id: 'polling',
    name: 'HTTP Polling',
    description: 'Periodic HTTP GET requests with a fixed retry cadence.',
    declaredComplexity: 2,
    configuration: pollingConfiguration,
    source: './transports/polling.js',
    run: runPollingBenchmark,
  },
  {
    id: 'sse',
    name: 'Server-Sent Events',
    description: 'A persistent HTTP event stream with fixed-delay reconnection.',
    declaredComplexity: 3,
    configuration: sseConfiguration,
    source: './transports/sse.js',
    run: runSseBenchmark,
  },
  {
    id: 'websockets',
    name: 'WebSockets',
    description: 'A persistent WebSocket with application-managed reconnect backoff.',
    declaredComplexity: 7,
    configuration: websocketConfiguration,
    source: './transports/websockets.js',
    run: runWebsocketBenchmark,
  },
]

/** Runs the three included loopback implementations; it never contacts an external service. */
export async function runBenchmark({ sampleCount = DEFAULT_SAMPLE_COUNT } = {}) {
  if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 100) {
    throw new RangeError('sampleCount must be an integer from 2 through 100.')
  }

  const candidates = []
  for (const definition of definitions) {
    const [result, implementationLines] = await Promise.all([
      definition.run(sampleCount),
      countImplementationLines(definition.source),
    ])
    candidates.push({
      id: definition.id,
      name: definition.name,
      description: definition.description,
      measurements: {
        deliveries: result.deliveries,
        p95LatencyMs: rounded(percentile95(result.latencies)),
        recoveryTimeMs: rounded(result.recoveryTimeMs),
        implementationLines,
      },
      declared: { complexity: definition.declaredComplexity },
    })
  }

  return validateEvidence({
    schemaVersion: 1,
    provenance: {
      kind: 'live',
      label: 'Live local benchmark',
      evidenceSource: 'Measurements from the checked-in loopback implementations in benchmark/transports/',
    },
    timestamp: new Date().toISOString(),
    sampleCount,
    environment: {
      nodeVersion: process.version,
      os: `${platform()} ${release()} (${arch()})`,
    },
    configuration: Object.fromEntries(definitions.map(({ id, configuration }) => [id, configuration])),
    candidates,
    disclaimer: 'These results measure only the included local implementations and configuration; they are not universal protocol performance claims.',
  })
}

export { countImplementationLines }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await runBenchmark()
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

