import { StatusBadge } from './StatusBadge'

export interface HardRequirementItem {
  id: string
  label: string
  description?: string
  status: 'pass' | 'fail'
  result?: string
}

export interface HardRequirementsPanelProps {
  title?: string
  description?: string
  requirements: readonly HardRequirementItem[]
}

export function HardRequirementsPanel({
  title = 'Hard requirements',
  description = 'A single failure removes a candidate from consideration.',
  requirements,
}: HardRequirementsPanelProps) {
  return (
    <section className="blg-criteria-panel" aria-labelledby="blg-hard-requirements-title">
      <header className="blg-section-heading">
        <div>
          <h2 id="blg-hard-requirements-title">{title}</h2>
          <p>{description}</p>
        </div>
        <span className="blg-count">{requirements.length}</span>
      </header>
      <ul className="blg-requirement-list">
        {requirements.map((requirement) => (
          <li key={requirement.id}>
            <div>
              <strong>{requirement.label}</strong>
              {requirement.description ? <p>{requirement.description}</p> : null}
            </div>
            <div className="blg-requirement-list__result">
              {requirement.result ? <span>{requirement.result}</span> : null}
              <StatusBadge
                status={requirement.status}
                label={requirement.status === 'pass' ? 'Pass' : 'Fail'}
                compact
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export interface WeightedPreferenceItem {
  id: string
  label: string
  description?: string
  weight: number
  weightLabel?: string
}

export interface WeightedPreferencesPanelProps {
  title?: string
  description?: string
  preferences: readonly WeightedPreferenceItem[]
  maxWeight?: number
}

export function WeightedPreferencesPanel({
  title = 'Weighted preferences',
  description = 'Eligible candidates are ranked against these priorities.',
  preferences,
  maxWeight = 10,
}: WeightedPreferencesPanelProps) {
  return (
    <section className="blg-criteria-panel" aria-labelledby="blg-weighted-preferences-title">
      <header className="blg-section-heading">
        <div>
          <h2 id="blg-weighted-preferences-title">{title}</h2>
          <p>{description}</p>
        </div>
        <span className="blg-count">{preferences.length}</span>
      </header>
      <ul className="blg-preference-list">
        {preferences.map((preference) => (
          <li key={preference.id}>
            <div className="blg-preference-list__copy">
              <strong>{preference.label}</strong>
              {preference.description ? <p>{preference.description}</p> : null}
            </div>
            <div className="blg-preference-list__weight">
              <span>{preference.weightLabel ?? `${preference.weight}/${maxWeight}`}</span>
              <meter min={0} max={maxWeight} value={preference.weight} aria-label={`${preference.label} weight`} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
