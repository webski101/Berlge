import { StatusBadge } from './StatusBadge'

export type ExperimentState = 'idle' | 'running' | 'complete' | 'failed'

export interface ExperimentStatusProps {
  state: ExperimentState
  completedRuns: number
  totalRuns: number
  statusText: string
  detail?: string
  lastRunAt?: string
}

export function ExperimentStatus({
  state,
  completedRuns,
  totalRuns,
  statusText,
  detail,
  lastRunAt,
}: ExperimentStatusProps) {
  const clampedRuns = Math.min(Math.max(completedRuns, 0), Math.max(totalRuns, 0))
  const badgeStatus = state === 'complete' ? 'pass' : state === 'failed' ? 'fail' : state === 'running' ? 'warning' : 'neutral'

  return (
    <section className={`blg-experiment-status blg-experiment-status--${state}`} aria-label="Experiment status" aria-live="polite">
      <div className="blg-experiment-status__main">
        <span className="blg-experiment-status__pulse" aria-hidden="true" />
        <div>
          <span className="blg-kicker">Experiment</span>
          <strong>{statusText}</strong>
          {detail ? <p>{detail}</p> : null}
        </div>
      </div>
      <div className="blg-experiment-status__progress">
        <div className="blg-experiment-status__progress-label">
          <span>Transports</span>
          <strong>{clampedRuns} / {totalRuns}</strong>
        </div>
        <progress max={Math.max(totalRuns, 1)} value={clampedRuns} aria-label={`${clampedRuns} of ${totalRuns} transports complete`} />
      </div>
      <div className="blg-experiment-status__aside">
        <StatusBadge status={badgeStatus} label={state === 'running' ? 'In progress' : state} compact />
        {lastRunAt ? <span>{lastRunAt}</span> : null}
      </div>
    </section>
  )
}
