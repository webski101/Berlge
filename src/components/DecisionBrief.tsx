export interface DecisionMetadataItem {
  label: string
  value: string
}

export interface DecisionBriefProps {
  title: string
  question: string
  context?: string
  metadata?: readonly DecisionMetadataItem[]
  label?: string
}

export function DecisionBrief({
  title,
  question,
  context,
  metadata = [],
  label = 'Decision brief',
}: DecisionBriefProps) {
  return (
    <section className="blg-decision-brief" aria-labelledby="blg-decision-title">
      <div className="blg-decision-brief__index" aria-hidden="true">BRF</div>
      <div className="blg-decision-brief__body">
        <p className="blg-kicker">{label}</p>
        <h1 id="blg-decision-title">{title}</h1>
        <p className="blg-decision-brief__question">{question}</p>
        {context ? <p className="blg-decision-brief__context">{context}</p> : null}
      </div>
      {metadata.length > 0 ? (
        <dl className="blg-decision-brief__meta">
          {metadata.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}
