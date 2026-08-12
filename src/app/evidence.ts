import { validateEvidence, type EvidenceReport } from '../../benchmark/evidence.js'
import { preparedRealtimeDecision, type DecisionEvidence } from '../data/index.ts'

export function ingestBenchmarkEvidence(value: unknown): DecisionEvidence {
  const report: EvidenceReport = validateEvidence(value)
  return {
    id: preparedRealtimeDecision.id,
    title: preparedRealtimeDecision.title,
    context: preparedRealtimeDecision.context,
    question: preparedRealtimeDecision.question,
    hardRequirements: preparedRealtimeDecision.hardRequirements,
    preferenceWeights: preparedRealtimeDecision.preferenceWeights,
    provenance: report.provenance,
    timestamp: report.timestamp,
    sampleCount: report.sampleCount,
    environment: report.environment,
    configuration: report.configuration,
    disclaimer: report.disclaimer,
    candidates: report.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      description: candidate.description,
      benchmark: {
        deliveriesSucceeded: candidate.measurements.deliveries.successful,
        deliveriesFailed: candidate.measurements.deliveries.failed,
        deliveriesTotal: candidate.measurements.deliveries.total,
        p95LatencyMs: candidate.measurements.p95LatencyMs,
        reconnectMs: candidate.measurements.recoveryTimeMs,
        implementationLines: candidate.measurements.implementationLines,
        complexity: candidate.declared.complexity,
      },
    })),
  }
}

export function describeBenchmarkError(error: unknown): string {
  return error instanceof Error ? error.message : 'The local benchmark returned an unknown error.'
}

export function getPreparedFallback(): DecisionEvidence {
  return preparedRealtimeDecision
}


