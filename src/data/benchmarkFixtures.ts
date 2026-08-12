export type CandidateId = 'polling' | 'sse' | 'websockets'

export interface BenchmarkEvidence {
  readonly deliveriesSucceeded: number
  readonly deliveriesFailed: number
  readonly deliveriesTotal: number
  readonly p95LatencyMs: number
  readonly reconnectMs: number
  readonly implementationLines: number
  readonly complexity: number
}

export interface BenchmarkCandidate {
  readonly id: CandidateId
  readonly name: string
  readonly description: string
  readonly benchmark: BenchmarkEvidence
}

export interface DecisionEvidence {
  readonly id: string
  readonly title: string
  readonly context: string
  readonly question: string
  readonly provenance: {
    readonly kind: 'live' | 'prepared'
    readonly label: string
    readonly evidenceSource: string
  }
  readonly timestamp: string
  readonly sampleCount: number
  readonly environment: { readonly nodeVersion: string; readonly os: string }
  readonly configuration: Readonly<Record<CandidateId, Readonly<Record<string, string | number>>>>
  readonly disclaimer: string
  readonly hardRequirements: {
    readonly allDeliveriesMustSucceed: boolean
    readonly maxP95LatencyMs: number
  }
  readonly preferenceWeights: {
    readonly p95Latency: number
    readonly reconnectTime: number
    readonly implementationSize: number
    readonly complexity: number
  }
  readonly candidates: readonly BenchmarkCandidate[]
}

/** Prepared demonstration values shown until a user intentionally runs the local benchmark. */
export const preparedRealtimeDecision = {
  id: 'realtime-delivery-transport',
  title: 'Choose a real-time update transport',
  context:
    'The product needs a browser update channel that is dependable on ordinary infrastructure and economical to implement and maintain.',
  question:
    'Should the MVP deliver server-to-browser updates with Polling, Server-Sent Events, or WebSockets?',
  provenance: {
    kind: 'prepared',
    label: 'Prepared demonstration evidence',
    evidenceSource: 'Checked-in fixture: src/data/benchmarkFixtures.ts',
  },
  timestamp: '2026-08-12T00:00:00.000Z',
  sampleCount: 10,
  environment: { nodeVersion: 'Not applicable', os: 'Prepared fixture; no live environment' },
  configuration: {
    polling: { deliveryCadenceMs: 600, recoveryDelayMs: 600 },
    sse: { deliveryCadenceMs: 150, recoveryDelayMs: 250 },
    websockets: { deliveryCadenceMs: 20, recoveryDelayMs: 400 },
  },
  disclaimer: 'These prepared values demonstrate the decision flow. They are not a live run or universal protocol performance claims.',
  hardRequirements: {
    allDeliveriesMustSucceed: true,
    maxP95LatencyMs: 500,
  },
  preferenceWeights: {
    p95Latency: 0.15,
    reconnectTime: 0.15,
    implementationSize: 0.35,
    complexity: 0.35,
  },
  candidates: [
    {
      id: 'polling',
      name: 'HTTP Polling',
      description: 'Periodic HTTP requests using a fixed client refresh interval.',
      benchmark: { deliveriesSucceeded: 10, deliveriesFailed: 0, deliveriesTotal: 10, p95LatencyMs: 650, reconnectMs: 620, implementationLines: 66, complexity: 2 },
    },
    {
      id: 'sse',
      name: 'Server-Sent Events',
      description: 'A persistent, one-way HTTP event stream with fixed-delay reconnection.',
      benchmark: { deliveriesSucceeded: 10, deliveriesFailed: 0, deliveriesTotal: 10, p95LatencyMs: 165, reconnectMs: 270, implementationLines: 101, complexity: 3 },
    },
    {
      id: 'websockets',
      name: 'WebSockets',
      description: 'A persistent, bidirectional socket with application-managed recovery.',
      benchmark: { deliveriesSucceeded: 10, deliveriesFailed: 0, deliveriesTotal: 10, p95LatencyMs: 40, reconnectMs: 430, implementationLines: 104, complexity: 7 },
    },
  ],
} as const satisfies DecisionEvidence
