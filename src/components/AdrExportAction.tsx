import { CopyIcon, DownloadIcon } from './icons'

export interface AdrExportActionProps {
  onExport: () => void
  disabled?: boolean
  isExporting?: boolean
  fileName?: string
  description?: string
  buttonLabel?: string
  onCopy?: () => void
  copyLabel?: string
  feedback?: string
}

export function AdrExportAction({
  onExport,
  disabled = false,
  isExporting = false,
  fileName = 'architecture-decision.md',
  description = 'Capture the constraints, evidence, scores, and selected approach in a portable decision record.',
  buttonLabel = 'Export ADR',
  onCopy,
  copyLabel = 'Copy Markdown',
  feedback,
}: AdrExportActionProps) {
  return (
    <aside className="blg-adr-action" aria-labelledby="blg-adr-title">
      <div>
        <span className="blg-kicker">Decision artifact</span>
        <h2 id="blg-adr-title">Make the evidence durable.</h2>
        <p>{description}</p>
        <code>{fileName}</code>
      </div>
      <div className="blg-adr-action__controls">
        <div className="blg-adr-action__buttons">
          {onCopy ? (
            <button
              className="blg-button blg-button--tertiary"
              type="button"
              onClick={onCopy}
              disabled={disabled || isExporting}
            >
              <CopyIcon className="blg-button__icon" />
              {isExporting ? 'Copying…' : copyLabel}
            </button>
          ) : null}
          <button
            className="blg-button blg-button--secondary"
            type="button"
            onClick={onExport}
            disabled={disabled || isExporting}
          >
            <DownloadIcon className="blg-button__icon" />
            {buttonLabel}
          </button>
        </div>
        <p className="blg-adr-action__feedback" aria-live="polite">
          {feedback ?? 'Markdown is generated locally from the result above.'}
        </p>
      </div>
    </aside>
  )
}
