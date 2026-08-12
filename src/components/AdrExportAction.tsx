import { DownloadIcon } from './icons'

export interface AdrExportActionProps {
  onExport: () => void
  disabled?: boolean
  isExporting?: boolean
  fileName?: string
  description?: string
  buttonLabel?: string
}

export function AdrExportAction({
  onExport,
  disabled = false,
  isExporting = false,
  fileName = 'architecture-decision.md',
  description = 'Capture the constraints, evidence, scores, and selected approach in a portable decision record.',
  buttonLabel = 'Export ADR',
}: AdrExportActionProps) {
  return (
    <aside className="blg-adr-action" aria-labelledby="blg-adr-title">
      <div>
        <span className="blg-kicker">Decision artifact</span>
        <h2 id="blg-adr-title">Make the evidence durable.</h2>
        <p>{description}</p>
        <code>{fileName}</code>
      </div>
      <button
        className="blg-button blg-button--secondary"
        type="button"
        onClick={onExport}
        disabled={disabled || isExporting}
        aria-busy={isExporting}
      >
        <DownloadIcon className="blg-button__icon" />
        {isExporting ? 'Preparing ADR…' : buttonLabel}
      </button>
    </aside>
  )
}
