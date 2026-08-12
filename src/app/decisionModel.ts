import { preparedRealtimeDecision, type BenchmarkCandidate, type DecisionEvidence } from '../data/index.ts'
import { scoreDecision, type Candidate, type CandidateEvaluation, type DecisionInput, type DecisionResult } from '../domain/index.ts'
import type { AdrInput } from '../lib/index.ts'

export interface RealtimeDecisionModel {
  readonly maximumP95LatencyMs: number
  readonly evidence: DecisionEvidence
  readonly input: DecisionInput
  readonly result: DecisionResult
  readonly winner: BenchmarkCandidate | null
}

function toScoringCandidate(candidate: BenchmarkCandidate): Candidate {
  return {
    id: candidate.id,
    name: candidate.name,
    metrics: {
      deliveries: { successful: candidate.benchmark.deliveriesSucceeded, failed: candidate.benchmark.deliveriesFailed, total: candidate.benchmark.deliveriesTotal },
      p95LatencyMs: candidate.benchmark.p95LatencyMs,
      reconnectTimeMs: candidate.benchmark.reconnectMs,
      implementationSizeLines: candidate.benchmark.implementationLines,
      complexity: candidate.benchmark.complexity,
    },
  }
}

/** Builds a fresh deterministic decision from explicit evidence and the live constraint. */
export function createRealtimeDecision(maximumP95LatencyMs: number, evidence: DecisionEvidence = preparedRealtimeDecision): RealtimeDecisionModel {
  const input: DecisionInput = {
    candidates: evidence.candidates.map(toScoringCandidate),
    hardRequirements: { maximumP95LatencyMs, requireAllDeliveriesSucceed: evidence.hardRequirements.allDeliveriesMustSucceed },
    weightedPreferences: {
      p95LatencyMs: evidence.preferenceWeights.p95Latency,
      reconnectTimeMs: evidence.preferenceWeights.reconnectTime,
      implementationSizeLines: evidence.preferenceWeights.implementationSize,
      complexity: evidence.preferenceWeights.complexity,
    },
  }
  const result = scoreDecision(input)
  return { maximumP95LatencyMs, evidence, input, result, winner: evidence.candidates.find((candidate) => candidate.id === result.winnerId) ?? null }
}

export function evaluationFor(model: RealtimeDecisionModel, candidateId: string): CandidateEvaluation {
  const evaluation = model.result.evaluations.find((candidate) => candidate.candidateId === candidateId)
  if (evaluation === undefined) throw new Error(`Missing evaluation for candidate: ${candidateId}`)
  return evaluation
}

export function decisionReasons(model: RealtimeDecisionModel): readonly string[] {
  const winner = model.winner
  if (winner === null) return [model.result.explanation]
  const winnerEvaluation = evaluationFor(model, winner.id)
  const eligible = model.result.evaluations.filter((evaluation) => evaluation.eligible)
  const latencyHeadroom = model.maximumP95LatencyMs - winner.benchmark.p95LatencyMs
  const reasons = [`${winner.benchmark.p95LatencyMs} ms measured p95 leaves ${Number(latencyHeadroom.toFixed(2))} ms of headroom under the ${model.maximumP95LatencyMs} ms hard limit.`]
  if (eligible.length === 1) {
    const excluded = model.result.evaluations.filter((evaluation) => !evaluation.eligible).map((evaluation) => evaluation.violations[0] === undefined ? `${evaluation.candidateName} is ineligible` : `${evaluation.candidateName}: ${evaluation.violations[0].message}`)
    reasons.push(`${winner.name} is the only eligible option; ${excluded.join('; ')}.`)
    return reasons
  }
  const runnerUp = [...eligible].filter((evaluation) => evaluation.candidateId !== winner.id).sort((left, right) => right.weightedPreferenceScore - left.weightedPreferenceScore)[0]
  const runnerUpCandidate = model.evidence.candidates.find((candidate) => candidate.id === runnerUp?.candidateId)
  if (runnerUp !== undefined && runnerUpCandidate !== undefined) {
    const lineSaving = runnerUpCandidate.benchmark.implementationLines - winner.benchmark.implementationLines
    reasons.push(
      `Its ${winnerEvaluation.weightedPreferenceScore.toFixed(3)} preference score leads ${runnerUpCandidate.name} at ${runnerUp.weightedPreferenceScore.toFixed(3)}.`,
      `${Math.abs(lineSaving)} ${lineSaving >= 0 ? 'fewer' : 'more'} measured implementation lines and declared complexity ${winner.benchmark.complexity} versus ${runnerUpCandidate.benchmark.complexity} decide the higher-weighted maintainability trade-off.`,
    )
  }
  return reasons
}

export function createAdrInput(model: RealtimeDecisionModel, decisionDate: string): AdrInput {
  const evidence = model.evidence
  return {
    decision: { title: evidence.title, status: 'Accepted', date: decisionDate, context: evidence.context, question: evidence.question },
    evidenceMetadata: {
      provenance: evidence.provenance.label,
      evidenceSource: evidence.provenance.evidenceSource,
      timestamp: evidence.timestamp,
      sampleCount: evidence.sampleCount,
      nodeVersion: evidence.environment.nodeVersion,
      os: evidence.environment.os,
      configurations: evidence.configuration,
      disclaimer: evidence.disclaimer,
    },
    hardRequirements: [
      { id: 'successful-deliveries', label: 'All benchmark deliveries succeed', description: 'Every measured delivery sample must succeed before an option can rank.' },
      { id: 'maximum-p95-latency', label: 'Maximum p95 latency', description: `Measured p95 latency must be at most ${model.maximumP95LatencyMs} ms.` },
    ],
    weightedPreferences: [
      { id: 'p95-latency', label: 'Measured p95 latency', weight: model.result.normalizedWeights.p95LatencyMs, description: 'Lower delivery latency is preferred.' },
      { id: 'recovery-time', label: 'Measured recovery time', weight: model.result.normalizedWeights.reconnectTimeMs, description: 'Faster recovery is preferred.' },
      { id: 'implementation-size', label: 'Measured implementation lines', weight: model.result.normalizedWeights.implementationSizeLines, description: 'A smaller implementation is easier to own.' },
      { id: 'complexity', label: 'Declared complexity', weight: model.result.normalizedWeights.complexity, description: 'Lower human-defined complexity is preferred.' },
    ],
    evaluations: evidence.candidates.map((candidate) => {
      const evaluation = evaluationFor(model, candidate.id)
      return { id: candidate.id, name: candidate.name, description: candidate.description, evidence: candidate.benchmark, eligible: evaluation.eligible, weightedScore: evaluation.weightedPreferenceScore, violations: evaluation.violations.map((violation) => violation.message) }
    }),
    result: { winnerId: model.result.winnerId ?? 'no-eligible-candidate', rationale: decisionReasons(model) },
    reproducibilityNote: 'Scores use deterministic min-max normalization and normalized preference weights. Re-run with npm run benchmark; no external network or AI service is involved.',
  }
}
