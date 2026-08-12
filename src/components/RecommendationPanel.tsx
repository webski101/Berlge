import { ArrowIcon } from './icons'

export interface RecommendationPanelProps {
  candidateName: string
  protocol?: string
  score: string
  confidenceLabel?: string
  headline: string
  rationale: string
  evidence: readonly string[]
  caveat?: string
  onInspectCandidate?: () => void
  inspectLabel?: string
}

export function RecommendationPanel({
  candidateName,
  protocol,
  score,
  confidenceLabel = 'Evidence-backed recommendation',
  headline,
  rationale,
  evidence,
  caveat,
  onInspectCandidate,
  inspectLabel = 'Inspect winning evidence',
}: RecommendationPanelProps) {
  return (
    <section className="blg-recommendation" aria-labelledby="blg-recommendation-title">
      <div className="blg-recommendation__stamp" aria-hidden="true">
        <span>Decision</span>
        <strong>01</strong>
      </div>
      <div className="blg-recommendation__main">
        <p className="blg-recommendation__label"><span aria-hidden="true" />{confidenceLabel}</p>
        <h2 id="blg-recommendation-title">{headline}</h2>
        <p className="blg-recommendation__rationale">{rationale}</p>
        <ul className="blg-recommendation__evidence">
          {evidence.map((item) => <li key={item}>{item}</li>)}
        </ul>
        {caveat ? <p className="blg-recommendation__caveat"><strong>Watch:</strong> {caveat}</p> : null}
        {onInspectCandidate ? (
          <button className="blg-text-button" type="button" onClick={onInspectCandidate}>
            {inspectLabel}
            <ArrowIcon />
          </button>
        ) : null}
      </div>
      <div className="blg-recommendation__result">
        {protocol ? <span>{protocol}</span> : null}
        <strong>{candidateName}</strong>
        <div>
          <span>Weighted score</span>
          <b>{score}</b>
        </div>
      </div>
    </section>
  )
}
