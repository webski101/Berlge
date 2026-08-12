import type {
  BenchmarkMetrics,
  Candidate,
  CandidateEvaluation,
  DecisionInput,
  DecisionResult,
  MetricScores,
  PreferenceMetric,
  RequirementViolation,
  WeightedPreferences,
} from './types.ts'

const preferenceMetrics = [
  'p95LatencyMs',
  'reconnectTimeMs',
  'implementationSizeLines',
  'complexity',
] as const satisfies readonly PreferenceMetric[]

const ZERO_METRIC_SCORES: MetricScores = {
  p95LatencyMs: 0,
  reconnectTimeMs: 0,
  implementationSizeLines: 0,
  complexity: 0,
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function validTestCounts(metrics: BenchmarkMetrics): boolean {
  const { passed, total } = metrics.tests
  return (
    Number.isInteger(passed) &&
    Number.isInteger(total) &&
    passed >= 0 &&
    total > 0 &&
    passed <= total
  )
}

function invalidBenchmarkFields(candidate: Candidate): string[] {
  const fields: string[] = preferenceMetrics.filter(
    (metric) => !isNonNegativeFinite(candidate.metrics[metric]),
  )

  if (!validTestCounts(candidate.metrics)) {
    fields.push('tests')
  }

  return fields
}

function requirementViolations(
  candidate: Candidate,
  input: DecisionInput,
): RequirementViolation[] {
  const violations: RequirementViolation[] = []
  const invalidFields = invalidBenchmarkFields(candidate)

  if (invalidFields.length > 0) {
    violations.push({
      code: 'invalid-benchmark',
      message: `Invalid benchmark data: ${invalidFields.join(', ')}`,
      actual: invalidFields.join(', '),
      required: 'finite non-negative metrics and at least one valid test result',
    })
  }

  const maximumLatency = input.hardRequirements.maximumP95LatencyMs
  if (!isNonNegativeFinite(maximumLatency)) {
    violations.push({
      code: 'invalid-hard-requirement',
      message: 'Maximum p95 latency must be finite and non-negative',
      actual: String(maximumLatency),
      required: 'a finite non-negative number',
    })
  } else if (
    isNonNegativeFinite(candidate.metrics.p95LatencyMs) &&
    candidate.metrics.p95LatencyMs > maximumLatency
  ) {
    violations.push({
      code: 'p95-latency-exceeded',
      message: `${candidate.metrics.p95LatencyMs} ms p95 exceeds the ${maximumLatency} ms maximum`,
      actual: `${candidate.metrics.p95LatencyMs} ms`,
      required: `at most ${maximumLatency} ms`,
    })
  }

  if (
    input.hardRequirements.requireAllTestsPass &&
    validTestCounts(candidate.metrics) &&
    candidate.metrics.tests.passed !== candidate.metrics.tests.total
  ) {
    violations.push({
      code: 'required-tests-failed',
      message: `${candidate.metrics.tests.passed}/${candidate.metrics.tests.total} tests passed; all are required`,
      actual: `${candidate.metrics.tests.passed}/${candidate.metrics.tests.total} passed`,
      required: `${candidate.metrics.tests.total}/${candidate.metrics.tests.total} passed`,
    })
  }

  return violations
}

function normalizeWeights(weights: WeightedPreferences): MetricScores {
  const usable = preferenceMetrics.map((metric) => {
    const weight = weights[metric]
    return Number.isFinite(weight) && weight > 0 ? weight : 0
  })
  const total = usable.reduce((sum, weight) => sum + weight, 0)

  if (!Number.isFinite(total) || total === 0) {
    return { ...ZERO_METRIC_SCORES }
  }

  return {
    p95LatencyMs: usable[0] / total,
    reconnectTimeMs: usable[1] / total,
    implementationSizeLines: usable[2] / total,
    complexity: usable[3] / total,
  }
}

function normalizeMetric(
  candidates: readonly Candidate[],
  metric: PreferenceMetric,
): readonly number[] {
  const validValues = candidates
    .map((candidate) => candidate.metrics[metric])
    .filter(isNonNegativeFinite)

  if (validValues.length === 0) {
    return candidates.map(() => 0)
  }

  const minimum = Math.min(...validValues)
  const maximum = Math.max(...validValues)

  return candidates.map((candidate) => {
    const value = candidate.metrics[metric]
    if (!isNonNegativeFinite(value)) return 0
    if (minimum === maximum) return 1
    return (maximum - value) / (maximum - minimum)
  })
}

function compareCandidateIds(left: CandidateEvaluation, right: CandidateEvaluation): number {
  if (left.candidateId === right.candidateId) return 0
  return left.candidateId < right.candidateId ? -1 : 1
}

function winnerExplanation(
  winner: CandidateEvaluation,
  candidate: Candidate,
  eligibleCount: number,
): string {
  const { metrics } = candidate
  return `${winner.candidateName} wins with preference score ${winner.weightedPreferenceScore.toFixed(4)} among ${eligibleCount} eligible candidate${eligibleCount === 1 ? '' : 's'}: ${metrics.p95LatencyMs} ms p95, ${metrics.reconnectTimeMs} ms reconnect, ${metrics.implementationSizeLines} lines, complexity ${metrics.complexity}, and ${metrics.tests.passed}/${metrics.tests.total} tests passed.`
}

/**
 * Produces a decision solely from supplied benchmark evidence.
 *
 * Preference metrics are min-max normalized across all candidates, with lower
 * raw values scoring higher. If eligible candidates tie, the lexicographically
 * smallest candidate id wins (UTF-16 code-unit order), making tie-breaking stable
 * and independent of input ordering.
 */
export function scoreDecision(input: DecisionInput): DecisionResult {
  const normalizedWeights = normalizeWeights(input.weightedPreferences)
  const metricScores = {
    p95LatencyMs: normalizeMetric(input.candidates, 'p95LatencyMs'),
    reconnectTimeMs: normalizeMetric(input.candidates, 'reconnectTimeMs'),
    implementationSizeLines: normalizeMetric(
      input.candidates,
      'implementationSizeLines',
    ),
    complexity: normalizeMetric(input.candidates, 'complexity'),
  }

  const evaluations = input.candidates.map((candidate, index) => {
    const normalizedMetrics: MetricScores = {
      p95LatencyMs: metricScores.p95LatencyMs[index] ?? 0,
      reconnectTimeMs: metricScores.reconnectTimeMs[index] ?? 0,
      implementationSizeLines:
        metricScores.implementationSizeLines[index] ?? 0,
      complexity: metricScores.complexity[index] ?? 0,
    }
    const violations = requirementViolations(candidate, input)
    const weightedPreferenceScore = preferenceMetrics.reduce(
      (score, metric) =>
        score + normalizedMetrics[metric] * normalizedWeights[metric],
      0,
    )

    return {
      candidateId: candidate.id,
      candidateName: candidate.name,
      eligible: violations.length === 0,
      violations,
      normalizedMetrics,
      weightedPreferenceScore,
    } satisfies CandidateEvaluation
  })

  const eligible = evaluations.filter((evaluation) => evaluation.eligible)
  const ranked = [...eligible].sort((left, right) => {
    const scoreDifference =
      right.weightedPreferenceScore - left.weightedPreferenceScore
    return scoreDifference === 0
      ? compareCandidateIds(left, right)
      : scoreDifference
  })
  const winner = ranked[0]

  if (winner === undefined) {
    const evidence = evaluations
      .map(
        (evaluation) =>
          `${evaluation.candidateName}: ${evaluation.violations.map((violation) => violation.message).join('; ')}`,
      )
      .join(' | ')
    return {
      evaluations,
      normalizedWeights,
      winnerId: null,
      explanation: evidence
        ? `No candidate is eligible. ${evidence}`
        : 'No candidate is eligible because no candidates were supplied.',
    }
  }

  const winnerCandidate = input.candidates.find(
    (candidate) => candidate.id === winner.candidateId,
  )

  return {
    evaluations,
    normalizedWeights,
    winnerId: winner.candidateId,
    explanation:
      winnerCandidate === undefined
        ? `${winner.candidateName} wins with preference score ${winner.weightedPreferenceScore.toFixed(4)}.`
        : winnerExplanation(winner, winnerCandidate, eligible.length),
  }
}
