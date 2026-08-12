export interface AdrDecisionMetadata {
  readonly title: string
  readonly status: string
  /** An explicit, already-formatted date such as 2026-08-12. */
  readonly date: string
  readonly context: string
  readonly question: string
}

export interface AdrHardRequirement {
  readonly id: string
  readonly label: string
  readonly description: string
}

export interface AdrWeightedPreference {
  readonly id: string
  readonly label: string
  /** A ratio (0-1) or percentage (1-100); it is displayed, not evaluated. */
  readonly weight: number
  readonly description: string
}

export interface AdrCandidateEvidence {
  readonly deliveriesSucceeded: number
  readonly deliveriesFailed: number
  readonly deliveriesTotal: number
  readonly p95LatencyMs: number
  readonly reconnectMs: number
  readonly implementationLines: number
  readonly complexity: number
}

export interface AdrEvidenceMetadata {
  readonly provenance: string
  readonly evidenceSource: string
  readonly timestamp: string
  readonly sampleCount: number
  readonly nodeVersion: string
  readonly os: string
  readonly configurations: Readonly<Record<string, Readonly<Record<string, string | number>>>>
  readonly disclaimer: string
}

export interface AdrCandidateEvaluation {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly evidence: AdrCandidateEvidence
  /** Eligibility and score must be supplied by the caller's scoring layer. */
  readonly eligible: boolean
  readonly weightedScore: number | null
  readonly violations: readonly string[]
}

export interface AdrDecisionResult {
  readonly winnerId: string
  readonly rationale: readonly string[]
}

export interface AdrInput {
  readonly decision: AdrDecisionMetadata
  readonly evidenceMetadata: AdrEvidenceMetadata
  readonly hardRequirements: readonly AdrHardRequirement[]
  readonly weightedPreferences: readonly AdrWeightedPreference[]
  readonly evaluations: readonly AdrCandidateEvaluation[]
  readonly result: AdrDecisionResult
  readonly reproducibilityNote: string
}

function escapeInline(value: string): string {
  return value.replace(/[\\`*_[\]{}<>]/g, '\\$&')
}

function escapeTableCell(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/`/g, '\\`')
    .replace(/\r\n|\r|\n/g, '<br>')
}

function formatWeight(weight: number): string {
  const percentage = weight <= 1 ? weight * 100 : weight
  return `${Number(percentage.toFixed(2))}%`
}

function formatScore(score: number | null): string {
  return score === null ? '—' : String(Number(score.toFixed(3)))
}

/**
 * Produces an ADR from caller-supplied evaluations without performing scoring.
 * Identical explicit input always produces identical Markdown.
 */
export function generateAdrMarkdown(input: AdrInput): string {
  const winner = input.evaluations.find(
    (evaluation) => evaluation.id === input.result.winnerId,
  )
  const winnerName = winner?.name ?? input.result.winnerId

  const lines: string[] = [
    `# ${escapeInline(input.decision.title)}`,
    '',
    `- **Status:** ${escapeInline(input.decision.status)}`,
    `- **Date:** ${escapeInline(input.decision.date)}`,
    '',
    '## Evidence provenance',
    '',
    `- **Provenance:** ${escapeInline(input.evidenceMetadata.provenance)}`,
    `- **Evidence source:** ${escapeInline(input.evidenceMetadata.evidenceSource)}`,
    `- **Measurement timestamp:** ${escapeInline(input.evidenceMetadata.timestamp)}`,
    `- **Sample count per transport:** ${input.evidenceMetadata.sampleCount}`,
    `- **Environment:** Node ${escapeInline(input.evidenceMetadata.nodeVersion)} on ${escapeInline(input.evidenceMetadata.os)}`,
    '',
    `> ${input.evidenceMetadata.disclaimer}`,
    '',
    '### Included implementation configuration',
    '',
    '| Transport | Configuration |',
    '| --- | --- |',
    ...Object.entries(input.evidenceMetadata.configurations).map(
      ([transport, configuration]) =>
        `| ${escapeTableCell(transport)} | ${escapeTableCell(Object.entries(configuration).map(([key, value]) => `${key}=${value}`).join('; '))} |`,
    ),
    '',
    '## Context',
    '',
    input.decision.context,
    '',
    `**Architecture question:** ${input.decision.question}`,
    '',
    '## Hard requirements',
    '',
  ]

  for (const requirement of input.hardRequirements) {
    lines.push(
      `- **${escapeInline(requirement.label)}:** ${requirement.description}`,
    )
  }

  lines.push(
    '',
    '## Weighted preferences',
    '',
    '| Preference | Weight | Description |',
    '| --- | ---: | --- |',
  )

  for (const preference of input.weightedPreferences) {
    lines.push(
      `| ${escapeTableCell(preference.label)} | ${formatWeight(preference.weight)} | ${escapeTableCell(preference.description)} |`,
    )
  }

  lines.push('', '## Options considered', '')

  for (const evaluation of input.evaluations) {
    lines.push(
      `- **${escapeInline(evaluation.name)}:** ${evaluation.description}`,
    )
  }

  lines.push(
    '',
    '## Evidence comparison',
    '',
    '| Option | Deliveries | Measured p95 latency (ms) | Measured recovery (ms) | Measured implementation lines | Declared complexity | Eligible | Weighted score |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |',
  )

  for (const evaluation of input.evaluations) {
    const evidence = evaluation.evidence
    lines.push(
      `| ${escapeTableCell(evaluation.name)} | ${evidence.deliveriesSucceeded}/${evidence.deliveriesTotal} succeeded (${evidence.deliveriesFailed} failed) | ${evidence.p95LatencyMs} | ${evidence.reconnectMs} | ${evidence.implementationLines} | ${evidence.complexity} | ${evaluation.eligible ? 'Yes' : 'No'} | ${formatScore(evaluation.weightedScore)} |`,
    )
  }

  lines.push('', '## Constraint violations', '')

  for (const evaluation of input.evaluations) {
    const violations =
      evaluation.violations.length === 0
        ? 'None.'
        : evaluation.violations.join('; ')
    lines.push(`- **${escapeInline(evaluation.name)}:** ${violations}`)
  }

  lines.push(
    '',
    '## Decision',
    '',
    `**Winner:** ${escapeInline(winnerName)}`,
    '',
    '### Rationale',
    '',
  )

  for (const reason of input.result.rationale) {
    lines.push(`- ${reason}`)
  }

  lines.push(
    '',
    '## Reproducibility',
    '',
    input.reproducibilityNote,
    '',
  )

  return lines.join('\n')
}
