import { StatusBadge } from './StatusBadge'
import type { CandidateId, CandidateIdentity, ConstraintStatus } from './types'

export interface EvidenceCellData {
  value: string
  detail?: string
  status?: ConstraintStatus
  statusLabel?: string
  isBest?: boolean
}

export interface EvidenceRowData {
  id: string
  label: string
  description?: string
  kind?: 'constraint' | 'evidence' | 'score'
  values: Record<CandidateId, EvidenceCellData>
}

export interface EvidenceComparisonTableProps {
  candidates: readonly CandidateIdentity[]
  rows: readonly EvidenceRowData[]
  winnerId?: CandidateId
  caption?: string
}

export function EvidenceComparisonTable({
  candidates,
  rows,
  winnerId,
  caption = 'Measured comparison across candidates',
}: EvidenceComparisonTableProps) {
  return (
    <section className="blg-evidence" aria-labelledby="blg-evidence-title">
      <header className="blg-section-heading blg-section-heading--rule">
        <div>
          <h2 id="blg-evidence-title">Evidence ledger</h2>
          <p>Measured values are compared directly; hard failures remain visible.</p>
        </div>
        <span className="blg-evidence__legend"><i aria-hidden="true" /> Best eligible result</span>
      </header>
      <div className="blg-table-wrap" tabIndex={0} role="region" aria-label="Scrollable evidence comparison">
        <table className="blg-evidence-table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              {candidates.map((candidate) => (
                <th key={candidate.id} scope="col" className={candidate.id === winnerId ? 'is-winner' : undefined}>
                  <span>{candidate.shortLabel ?? candidate.name}</span>
                  {candidate.id === winnerId ? <small>Recommended</small> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={`blg-evidence-table__row--${row.kind ?? 'evidence'}`}>
                <th scope="row">
                  <span>{row.label}</span>
                  {row.description ? <small>{row.description}</small> : null}
                </th>
                {candidates.map((candidate) => {
                  const cell = row.values[candidate.id]
                  return (
                    <td key={candidate.id} className={cell.isBest ? 'is-best' : undefined}>
                      <strong>{cell.value}</strong>
                      {cell.detail ? <small>{cell.detail}</small> : null}
                      {cell.status && cell.statusLabel ? (
                        <StatusBadge status={cell.status} label={cell.statusLabel} compact />
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
