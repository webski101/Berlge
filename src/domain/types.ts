/** Counts from the deterministic test suite run for a candidate. */
export interface TestPassCounts {
  readonly passed: number
  readonly total: number
}

/**
 * Benchmark evidence used by the decision engine.
 *
 * Complexity is deliberately numeric: a lower value means a simpler solution.
 * Callers may use any documented ordinal scale (for example, 1 = simplest and
 * 5 = most complex), provided the same scale is used for every candidate.
 */
export interface BenchmarkMetrics {
  readonly tests: TestPassCounts
  readonly p95LatencyMs: number
  readonly reconnectTimeMs: number
  readonly implementationSizeLines: number
  readonly complexity: number
}

export interface Candidate {
  readonly id: string
  readonly name: string
  readonly metrics: BenchmarkMetrics
}

/** Requirements are gates, not contributors to the preference score. */
export interface HardRequirements {
  readonly maximumP95LatencyMs: number
  readonly requireAllTestsPass: boolean
}

/**
 * Relative importance of each lower-is-better preference metric. The engine
 * normalizes finite positive weights to a sum of one. Other weights become zero.
 */
export interface WeightedPreferences {
  readonly p95LatencyMs: number
  readonly reconnectTimeMs: number
  readonly implementationSizeLines: number
  readonly complexity: number
}

export type PreferenceMetric = keyof WeightedPreferences

export interface DecisionInput {
  readonly candidates: readonly Candidate[]
  readonly hardRequirements: HardRequirements
  readonly weightedPreferences: WeightedPreferences
}

export type ViolationCode =
  | 'invalid-benchmark'
  | 'invalid-hard-requirement'
  | 'p95-latency-exceeded'
  | 'required-tests-failed'

export interface RequirementViolation {
  readonly code: ViolationCode
  readonly message: string
  readonly actual: string
  readonly required: string
}

export type MetricScores = Readonly<Record<PreferenceMetric, number>>

export interface CandidateEvaluation {
  readonly candidateId: string
  readonly candidateName: string
  readonly eligible: boolean
  readonly violations: readonly RequirementViolation[]
  /** Lower raw values become scores from zero (worst) to one (best). */
  readonly normalizedMetrics: MetricScores
  /** Sum of normalized metrics multiplied by normalized preference weights. */
  readonly weightedPreferenceScore: number
}

export interface DecisionResult {
  readonly evaluations: readonly CandidateEvaluation[]
  readonly normalizedWeights: MetricScores
  readonly winnerId: string | null
  readonly explanation: string
}
