export type CandidateId = 'polling' | 'sse' | 'websockets'

export type CandidateTone = 'neutral' | 'recommended' | 'ineligible'

export type ConstraintStatus = 'pass' | 'fail' | 'warning' | 'neutral'

export interface CandidateIdentity {
  id: CandidateId
  name: string
  shortLabel?: string
}

export interface CandidateMetricSet {
  deliveries: string
  p95Latency: string
  reconnect: string
  lines: string
  complexity: string
}

export interface CandidateSummaryData extends CandidateIdentity {
  protocol: string
  description: string
  eligibility: 'eligible' | 'ineligible'
  violations: readonly string[]
  weightedScore: string
  metrics: CandidateMetricSet
}
