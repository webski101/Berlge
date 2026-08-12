import {
  preparedRealtimeDecision,
  type BenchmarkCandidate,
} from '../data/index.ts'
import {
  scoreDecision,
  type Candidate,
  type CandidateEvaluation,
  type DecisionInput,
  type DecisionResult,
} from '../domain/index.ts'
import type { AdrInput } from '../lib/index.ts'

export interface RealtimeDecisionModel {
  readonly maximumP95LatencyMs: number
  readonly input: DecisionInput
  readonly result: DecisionResult
  readonly winner: BenchmarkCandidate | null
}

function toScoringCandidate(candidate: BenchmarkCandidate): Candidate {
  return {
    id: candidate.id,
    name: candidate.name,
    metrics: {
      tests: {
        passed: candidate.benchmark.testsPassed,
        total: candidate.benchmark.testsTotal,
      },
      p95LatencyMs: candidate.benchmark.p95LatencyMs,
      reconnectTimeMs: candidate.benchmark.reconnectMs,
      implementationSizeLines: candidate.benchmark.implementationLines,
      complexity: candidate.benchmark.complexity,
    },
  }
}

/** Builds a fresh decision from the prepared evidence and the live hard constraint. */
export function createRealtimeDecision(
  maximumP95LatencyMs: number,
): RealtimeDecisionModel {
  const input: DecisionInput = {
    candidates: preparedRealtimeDecision.candidates.map(toScoringCandidate),
    hardRequirements: {
      maximumP95LatencyMs,
      requireAllTestsPass:
        preparedRealtimeDecision.hardRequirements.allTestsMustPass,
    },
    weightedPreferences: {
      p95LatencyMs: preparedRealtimeDecision.preferenceWeights.p95Latency,
      reconnectTimeMs:
        preparedRealtimeDecision.preferenceWeights.reconnectTime,
      implementationSizeLines:
        preparedRealtimeDecision.preferenceWeights.implementationSize,
      complexity: preparedRealtimeDecision.preferenceWeights.complexity,
    },
  }
  const result = scoreDecision(input)

  return {
    maximumP95LatencyMs,
    input,
    result,
    winner:
      preparedRealtimeDecision.candidates.find(
        (candidate) => candidate.id === result.winnerId,
      ) ?? null,
  }
}

export function evaluationFor(
  model: RealtimeDecisionModel,
  candidateId: string,
): CandidateEvaluation {
  const evaluation = model.result.evaluations.find(
    (candidate) => candidate.candidateId === candidateId,
  )

  if (evaluation === undefined) {
    throw new Error(`Missing evaluation for candidate: ${candidateId}`)
  }

  return evaluation
}

export function decisionReasons(
  model: RealtimeDecisionModel,
): readonly string[] {
  const winner = model.winner
  if (winner === null) return [model.result.explanation]

  const winnerEvaluation = evaluationFor(model, winner.id)
  const eligible = model.result.evaluations.filter(
    (evaluation) => evaluation.eligible,
  )
  const latencyHeadroom =
    model.maximumP95LatencyMs - winner.benchmark.p95LatencyMs
  const reasons = [
    `${winner.benchmark.p95LatencyMs} ms p95 leaves ${latencyHeadroom} ms of headroom under the ${model.maximumP95LatencyMs} ms hard limit.`,
  ]

  if (eligible.length === 1) {
    const excluded = model.result.evaluations
      .filter((evaluation) => !evaluation.eligible)
      .map((evaluation) => {
        const violation = evaluation.violations[0]
        return violation === undefined
          ? `${evaluation.candidateName} is ineligible`
          : `${evaluation.candidateName}: ${violation.message}`
      })

    reasons.push(
      `${winner.name} is the only eligible option; ${excluded.join('; ')}.`,
    )
    return reasons
  }

  const runnerUp = [...eligible]
    .filter((evaluation) => evaluation.candidateId !== winner.id)
    .sort(
      (left, right) =>
        right.weightedPreferenceScore - left.weightedPreferenceScore,
    )[0]
  const runnerUpCandidate = preparedRealtimeDecision.candidates.find(
    (candidate) => candidate.id === runnerUp?.candidateId,
  )

  if (runnerUp !== undefined && runnerUpCandidate !== undefined) {
    const lineSaving =
      runnerUpCandidate.benchmark.implementationLines -
      winner.benchmark.implementationLines
    reasons.push(
      `Its ${winnerEvaluation.weightedPreferenceScore.toFixed(3)} preference score leads ${runnerUpCandidate.name} at ${runnerUp.weightedPreferenceScore.toFixed(3)}.`,
      `${Math.abs(lineSaving)} ${lineSaving >= 0 ? 'fewer' : 'more'} implementation lines and complexity ${winner.benchmark.complexity} versus ${runnerUpCandidate.benchmark.complexity} decide the higher-weighted maintainability trade-off.`,
    )
  }

  return reasons
}

export function createAdrInput(
  model: RealtimeDecisionModel,
  decisionDate: string,
): AdrInput {
  const winnerId = model.result.winnerId ?? 'no-eligible-candidate'

  return {
    decision: {
      title: preparedRealtimeDecision.title,
      status: 'Accepted',
      date: decisionDate,
      context: preparedRealtimeDecision.context,
      question: preparedRealtimeDecision.question,
    },
    hardRequirements: [
      {
        id: 'passing-tests',
        label: 'All benchmark tests pass',
        description: 'Every prepared test must pass before an option can rank.',
      },
      {
        id: 'maximum-p95-latency',
        label: 'Maximum p95 latency',
        description: `p95 latency must be at most ${model.maximumP95LatencyMs} ms.`,
      },
    ],
    weightedPreferences: [
      {
        id: 'p95-latency',
        label: 'p95 latency',
        weight: model.result.normalizedWeights.p95LatencyMs,
        description: 'Lower delivery latency is preferred.',
      },
      {
        id: 'reconnect-time',
        label: 'Reconnect time',
        weight: model.result.normalizedWeights.reconnectTimeMs,
        description: 'Faster recovery is preferred.',
      },
      {
        id: 'implementation-size',
        label: 'Implementation size',
        weight: model.result.normalizedWeights.implementationSizeLines,
        description: 'A smaller implementation is easier to own.',
      },
      {
        id: 'complexity',
        label: 'Complexity',
        weight: model.result.normalizedWeights.complexity,
        description: 'Lower operational complexity is preferred.',
      },
    ],
    evaluations: preparedRealtimeDecision.candidates.map((candidate) => {
      const evaluation = evaluationFor(model, candidate.id)
      return {
        id: candidate.id,
        name: candidate.name,
        description: candidate.description,
        evidence: candidate.benchmark,
        eligible: evaluation.eligible,
        weightedScore: evaluation.weightedPreferenceScore,
        violations: evaluation.violations.map(
          (violation) => violation.message,
        ),
      }
    }),
    result: {
      winnerId,
      rationale: decisionReasons(model),
    },
    reproducibilityNote: `Generated locally from the prepared Berlge fixture with a ${model.maximumP95LatencyMs} ms maximum p95 latency. Scores use deterministic min-max normalization and normalized preference weights; no network or AI service is involved.`,
  }
}
