export type EvidenceKind = 'live' | 'prepared'
export type EvidenceCandidateId = 'polling' | 'sse' | 'websockets'

export interface EvidenceReport {
  readonly schemaVersion: 1
  readonly provenance: {
    readonly kind: EvidenceKind
    readonly label: string
    readonly evidenceSource: string
  }
  readonly timestamp: string
  readonly sampleCount: number
  readonly environment: { readonly nodeVersion: string; readonly os: string }
  readonly configuration: Readonly<Record<EvidenceCandidateId, Readonly<Record<string, string | number>>>>
  readonly candidates: readonly {
    readonly id: EvidenceCandidateId
    readonly name: string
    readonly description: string
    readonly measurements: {
      readonly deliveries: { readonly successful: number; readonly failed: number; readonly total: number }
      readonly p95LatencyMs: number
      readonly recoveryTimeMs: number
      readonly implementationLines: number
    }
    readonly declared: { readonly complexity: number }
  }[]
  readonly disclaimer: string
}

export function validateEvidence(value: unknown): EvidenceReport
export const candidateIds: readonly EvidenceCandidateId[]

