import { AlertIcon, CheckIcon, CrossIcon, MinusIcon } from './icons'
import type { ConstraintStatus } from './types'

export interface StatusBadgeProps {
  status: ConstraintStatus
  label: string
  compact?: boolean
}

export function StatusBadge({ status, label, compact = false }: StatusBadgeProps) {
  const Icon = status === 'pass'
    ? CheckIcon
    : status === 'fail'
      ? CrossIcon
      : status === 'warning'
        ? AlertIcon
        : MinusIcon

  return (
    <span className={`blg-status-badge blg-status-badge--${status}${compact ? ' blg-status-badge--compact' : ''}`}>
      <Icon className="blg-status-badge__icon" />
      <span>{label}</span>
    </span>
  )
}
