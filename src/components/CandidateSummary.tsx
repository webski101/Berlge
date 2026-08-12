import { StatusBadge } from './StatusBadge'
import type { CandidateId, CandidateSummaryData } from './types'

export interface CandidateSummaryCardsProps {
  candidates: readonly CandidateSummaryData[]
  winnerId?: CandidateId
  selectedId?: CandidateId
  onSelect?: (candidateId: CandidateId) => void
}

const metricLabels = {
  deliveries: 'Measured deliveries',
  p95Latency: 'Measured p95 latency',
  reconnect: 'Measured recovery',
  lines: 'Measured lines',
  complexity: 'Declared complexity',
} as const

export function CandidateSummaryCards({
  candidates,
  winnerId,
  selectedId,
  onSelect,
}: CandidateSummaryCardsProps) {
  return (
    <section className="blg-candidates" aria-labelledby="blg-candidates-title">
      <header className="blg-section-heading blg-section-heading--rule">
        <div>
          <h2 id="blg-candidates-title">Candidate field</h2>
          <p>Constraint results and measured evidence for all three approaches.</p>
        </div>
        <span className="blg-count">{candidates.length}</span>
      </header>
      <div className="blg-candidate-grid">
        {candidates.map((candidate) => {
          const isWinner = candidate.id === winnerId
          const isSelected = candidate.id === selectedId
          const cardClassName = [
            'blg-candidate-card',
            isWinner ? 'blg-candidate-card--winner' : '',
            candidate.eligibility === 'ineligible' ? 'blg-candidate-card--ineligible' : '',
            isSelected ? 'blg-candidate-card--selected' : '',
          ].filter(Boolean).join(' ')

          const content = (
            <>
              <div className="blg-candidate-card__topline">
                <span>{candidate.protocol}</span>
                <StatusBadge
                  status={candidate.eligibility === 'eligible' ? 'pass' : 'fail'}
                  label={isWinner ? 'Recommended' : candidate.eligibility}
                  compact
                />
              </div>
              <div className="blg-candidate-card__title-row">
                <div>
                  <h3>{candidate.name}</h3>
                  <p>{candidate.description}</p>
                </div>
                <div className="blg-score" aria-label={`Weighted score ${candidate.weightedScore}`}>
                  <span>Score</span>
                  <strong>{candidate.weightedScore}</strong>
                </div>
              </div>
              <dl className="blg-candidate-metrics">
                {Object.entries(metricLabels).map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{candidate.metrics[key as keyof CandidateSummaryData['metrics']]}</dd>
                  </div>
                ))}
              </dl>
              {candidate.violations.length > 0 ? (
                <div className="blg-candidate-card__violations">
                  <strong>{candidate.violations.length} constraint {candidate.violations.length === 1 ? 'violation' : 'violations'}</strong>
                  <ul>
                    {candidate.violations.map((violation) => <li key={violation}>{violation}</li>)}
                  </ul>
                </div>
              ) : (
                <p className="blg-candidate-card__clear">All hard requirements satisfied.</p>
              )}
            </>
          )

          return onSelect ? (
            <button
              key={candidate.id}
              className={cardClassName}
              type="button"
              onClick={() => onSelect(candidate.id)}
              aria-pressed={isSelected}
            >
              {content}
            </button>
          ) : (
            <article key={candidate.id} className={cardClassName}>{content}</article>
          )
        })}
      </div>
    </section>
  )
}
