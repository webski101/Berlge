export type CandidateId = 'polling' | 'sse' | 'websockets'

export interface BenchmarkEvidence {
  readonly testsPassed: number
  readonly testsTotal: number
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

export interface PreparedDecisionFixture {
  readonly id: string
  readonly title: string
  readonly context: string
  readonly question: string
  readonly hardRequirements: {
    readonly allTestsMustPass: boolean
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

/**
 * Prepared, deterministic evidence for the local-first comparison demo.
 *
 * At the default 500 ms latency limit, Polling is ineligible and SSE wins the
 * preference trade-off over WebSockets. Tightening the limit to 100 ms leaves
 * WebSockets as the only eligible option.
 */
export const preparedRealtimeDecision = {
  id: 'realtime-delivery-transport',
  title: 'Choose a real-time update transport',
  context:
    'The product needs a browser update channel that is dependable on ordinary infrastructure and economical to implement and maintain.',
  question:
    'Should the MVP deliver server-to-browser updates with Polling, Server-Sent Events, or WebSockets?',
  hardRequirements: {
    allTestsMustPass: true,
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
      name: 'Polling',
      description: 'Periodic HTTP requests using a fixed client refresh interval.',
      benchmark: {
        testsPassed: 36,
        testsTotal: 36,
        p95LatencyMs: 820,
        reconnectMs: 1_050,
        implementationLines: 54,
        complexity: 2,
      },
    },
    {
      id: 'sse',
      name: 'Server-Sent Events',
      description: 'A persistent, one-way HTTP event stream with native reconnection.',
      benchmark: {
        testsPassed: 36,
        testsTotal: 36,
        p95LatencyMs: 180,
        reconnectMs: 340,
        implementationLines: 82,
        complexity: 3,
      },
    },
    {
      id: 'websockets',
      name: 'WebSockets',
      description: 'A persistent, bidirectional socket with application-managed recovery.',
      benchmark: {
        testsPassed: 36,
        testsTotal: 36,
        p95LatencyMs: 72,
        reconnectMs: 510,
        implementationLines: 156,
        complexity: 7,
      },
    },
  ],
} as const satisfies PreparedDecisionFixture
