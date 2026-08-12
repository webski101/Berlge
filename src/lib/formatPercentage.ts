const percentageFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2,
})

/** Formats a decimal weight as a compact, human-readable percentage. */
export function formatPercentage(value: number): string {
  return percentageFormatter.format(value)
}
