import { useId } from 'react'

export interface LatencyThresholdControlProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  label?: string
  formattedValue?: string
  description?: string
  disabled?: boolean
}

export function LatencyThresholdControl({
  value,
  min,
  max,
  step = 10,
  onChange,
  label = 'Maximum p95 latency',
  formattedValue = `${value} ms`,
  description = 'Candidates above this threshold fail the latency constraint.',
  disabled = false,
}: LatencyThresholdControlProps) {
  const inputId = useId()
  const descriptionId = `${inputId}-description`

  return (
    <div className="blg-threshold-control">
      <div className="blg-threshold-control__copy">
        <label htmlFor={inputId}>{label}</label>
        <p id={descriptionId}>{description}</p>
      </div>
      <output className="blg-threshold-control__value" htmlFor={inputId}>{formattedValue}</output>
      <div className="blg-threshold-control__range">
        <span aria-hidden="true">{min}</span>
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-describedby={descriptionId}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        />
        <span aria-hidden="true">{max}</span>
      </div>
    </div>
  )
}
