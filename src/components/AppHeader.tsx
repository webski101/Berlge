import { RunIcon } from './icons'

export interface AppHeaderProps {
  productName?: string
  workspaceLabel?: string
  experimentId?: string
  onRunExperiment?: () => void
  runLabel?: string
  isRunning?: boolean
  isRunDisabled?: boolean
  runDescriptionId?: string
}

export function AppHeader({
  productName = 'Berlge',
  workspaceLabel = 'Decision lab',
  experimentId,
  onRunExperiment,
  runLabel = 'Run experiment',
  isRunning = false,
  isRunDisabled = false,
  runDescriptionId,
}: AppHeaderProps) {
  return (
    <header className="blg-app-header">
      <div className="blg-brand" aria-label={`${productName}, ${workspaceLabel}`}>
        <span className="blg-brand__mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="blg-brand__name">{productName}</span>
        <span className="blg-brand__workspace">{workspaceLabel}</span>
      </div>

      <div className="blg-app-header__actions">
        {experimentId ? <span className="blg-run-id">Run {experimentId}</span> : null}
        {onRunExperiment ? (
          <button
            className="blg-button blg-button--primary"
            type="button"
            onClick={onRunExperiment}
            disabled={isRunning || isRunDisabled}
            aria-busy={isRunning}
            aria-describedby={runDescriptionId}
          >
            <RunIcon className="blg-button__icon" />
            {isRunning ? 'Experiment running…' : runLabel}
          </button>
        ) : null}
      </div>
    </header>
  )
}
