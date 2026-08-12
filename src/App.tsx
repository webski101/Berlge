import { useMemo, useRef, useState } from 'react'

import {
  AdrExportAction,
  AppHeader,
  CandidateSummaryCards,
  DecisionBrief,
  EvidenceComparisonTable,
  ExperimentStatus,
  HardRequirementsPanel,
  LatencyThresholdControl,
  RecommendationPanel,
  WeightedPreferencesPanel,
  type CandidateId,
  type CandidateSummaryData,
  type EvidenceCellData,
  type EvidenceRowData,
  type HardRequirementItem,
  type WeightedPreferenceItem,
} from './components/index.ts'
import { preparedRealtimeDecision, type DecisionEvidence } from './data/index.ts'
import { formatPercentage, generateAdrMarkdown } from './lib/index.ts'
import {
  createAdrInput,
  createRealtimeDecision,
  decisionReasons,
  evaluationFor,
  type RealtimeDecisionModel,
} from './app/decisionModel.ts'
import { describeBenchmarkError, ingestBenchmarkEvidence, getPreparedFallback } from './app/evidence.ts'
import './styles/app.css'

const DECISION_DATE = '2026-08-12'
const LATENCY_PRESETS = [500, 100] as const
const protocolLabels: Record<CandidateId, string> = {
  polling: 'HTTP interval',
  sse: 'HTTP event stream',
  websockets: 'Full-duplex socket',
}

const formatScore = (score: number) => score.toFixed(3)
const formatTimestamp = (timestamp: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(timestamp))

function cellsFor(evidence: DecisionEvidence, factory: (candidateId: CandidateId) => EvidenceCellData): Record<CandidateId, EvidenceCellData> {
  return Object.fromEntries(evidence.candidates.map((candidate) => [candidate.id, factory(candidate.id)])) as Record<CandidateId, EvidenceCellData>
}

function bestEligibleId(model: RealtimeDecisionModel, metric: 'p95LatencyMs' | 'reconnectTimeMs' | 'implementationSizeLines' | 'complexity'): CandidateId | undefined {
  return model.input.candidates
    .filter((candidate) => evaluationFor(model, candidate.id).eligible)
    .sort((left, right) => left.metrics[metric] - right.metrics[metric])[0]?.id as CandidateId | undefined
}

function buildEvidenceRows(model: RealtimeDecisionModel): readonly EvidenceRowData[] {
  const evidence = model.evidence
  const candidatesById = new Map(evidence.candidates.map((candidate) => [candidate.id, candidate]))
  const candidateFor = (candidateId: CandidateId) => {
    const candidate = candidatesById.get(candidateId)
    if (candidate === undefined) throw new Error(`Missing evidence candidate: ${candidateId}`)
    return candidate
  }
  const bestP95 = bestEligibleId(model, 'p95LatencyMs')
  const bestRecovery = bestEligibleId(model, 'reconnectTimeMs')
  const bestSize = bestEligibleId(model, 'implementationSizeLines')
  const bestComplexity = bestEligibleId(model, 'complexity')
  return [
    {
      id: 'deliveries', label: 'Measured deliveries', description: 'Every benchmark sample must be delivered', kind: 'constraint',
      values: cellsFor(evidence, (candidateId) => {
        const benchmark = candidateFor(candidateId).benchmark
        const passes = benchmark.deliveriesFailed === 0
        return { value: `${benchmark.deliveriesSucceeded}/${benchmark.deliveriesTotal}`, detail: passes ? 'Zero delivery failures' : `${benchmark.deliveriesFailed} failed`, status: passes ? 'pass' : 'fail', statusLabel: passes ? 'Pass' : 'Fail' }
      }),
    },
    {
      id: 'p95-latency', label: 'Measured p95 latency', description: `Hard limit: at most ${model.maximumP95LatencyMs} ms`, kind: 'constraint',
      values: cellsFor(evidence, (candidateId) => {
        const candidate = candidateFor(candidateId)
        const evaluation = evaluationFor(model, candidateId)
        return { value: `${candidate.benchmark.p95LatencyMs} ms`, detail: evaluation.eligible ? `${Number((model.maximumP95LatencyMs - candidate.benchmark.p95LatencyMs).toFixed(2))} ms headroom` : evaluation.violations.map((violation) => violation.message).join('; '), status: evaluation.eligible ? 'pass' : 'fail', statusLabel: evaluation.eligible ? 'Eligible' : 'Violation', isBest: candidateId === bestP95 }
      }),
    },
    { id: 'recovery', label: 'Measured recovery time', description: 'Lower is preferred · 15% weight', values: cellsFor(evidence, (id) => ({ value: `${candidateFor(id).benchmark.reconnectMs} ms`, isBest: id === bestRecovery })) },
    { id: 'implementation-size', label: 'Measured implementation lines', description: 'Nonblank, non-comment transport source lines · 35% weight', values: cellsFor(evidence, (id) => ({ value: `${candidateFor(id).benchmark.implementationLines} lines`, isBest: id === bestSize })) },
    { id: 'complexity', label: 'Declared complexity', description: 'Human-defined ordinal factor · 35% weight', values: cellsFor(evidence, (id) => ({ value: String(candidateFor(id).benchmark.complexity), detail: 'Shared ordinal scale', isBest: id === bestComplexity })) },
    {
      id: 'weighted-score', label: 'Weighted score', description: 'Deterministic normalization; hard gates take precedence', kind: 'score',
      values: cellsFor(evidence, (candidateId) => {
        const evaluation = evaluationFor(model, candidateId)
        return { value: formatScore(evaluation.weightedPreferenceScore), detail: evaluation.eligible ? 'Ranked' : 'Excluded by hard gate', status: evaluation.eligible ? 'pass' : 'fail', statusLabel: evaluation.eligible ? 'Ranked' : 'Excluded', isBest: candidateId === model.result.winnerId }
      }),
    },
  ]
}

function fallbackCopy(markdown: string): boolean {
  const textArea = document.createElement('textarea')
  textArea.value = markdown
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.append(textArea)
  textArea.select()
  const copied = document.execCommand('copy')
  textArea.remove()
  return copied
}

function App() {
  const [maximumLatency, setMaximumLatency] = useState(500)
  const [evidence, setEvidence] = useState<DecisionEvidence>(preparedRealtimeDecision)
  const [isRunning, setIsRunning] = useState(false)
  const [runNumber, setRunNumber] = useState(0)
  const [benchmarkError, setBenchmarkError] = useState('')
  const [fallbackConfirmed, setFallbackConfirmed] = useState(false)
  const [exportFeedback, setExportFeedback] = useState('')
  const [isCopying, setIsCopying] = useState(false)
  const runLock = useRef(false)

  const model = useMemo(() => createRealtimeDecision(maximumLatency, evidence), [maximumLatency, evidence])
  const adrMarkdown = useMemo(() => generateAdrMarkdown(createAdrInput(model, DECISION_DATE)), [model])
  const reasons = useMemo(() => decisionReasons(model), [model])
  const evidenceRows = useMemo(() => buildEvidenceRows(model), [model])
  const winner = model.winner
  if (winner === null) throw new Error('The configured latency range must retain an eligible option.')
  const winnerEvaluation = evaluationFor(model, winner.id)
  const eligibleCount = model.result.evaluations.filter((evaluation) => evaluation.eligible).length
  const totalDeliveries = evidence.candidates.reduce((total, candidate) => total + candidate.benchmark.deliveriesTotal, 0)
  const successfulDeliveries = evidence.candidates.reduce((total, candidate) => total + candidate.benchmark.deliveriesSucceeded, 0)

  const candidateSummaries: readonly CandidateSummaryData[] = evidence.candidates.map((candidate) => {
    const evaluation = evaluationFor(model, candidate.id)
    return {
      id: candidate.id, name: candidate.name, protocol: protocolLabels[candidate.id], description: candidate.description,
      eligibility: evaluation.eligible ? 'eligible' : 'ineligible',
      violations: evaluation.violations.map((violation) => violation.message),
      weightedScore: formatScore(evaluation.weightedPreferenceScore),
      metrics: {
        deliveries: `${candidate.benchmark.deliveriesSucceeded}/${candidate.benchmark.deliveriesTotal}`,
        p95Latency: `${candidate.benchmark.p95LatencyMs} ms`, reconnect: `${candidate.benchmark.reconnectMs} ms`,
        lines: String(candidate.benchmark.implementationLines), complexity: String(candidate.benchmark.complexity),
      },
    }
  })

  const hardRequirements: readonly HardRequirementItem[] = [
    { id: 'all-deliveries-succeed', label: 'All benchmark deliveries succeed', description: 'A failed sample removes a candidate before preference scoring.', status: successfulDeliveries === totalDeliveries ? 'pass' : 'fail', result: `${successfulDeliveries} / ${totalDeliveries} delivered` },
    { id: 'maximum-latency', label: `Measured p95 latency ≤ ${maximumLatency} ms`, description: 'The active latency ceiling is a hard gate, not a weight.', status: eligibleCount > 0 ? 'pass' : 'fail', result: `${eligibleCount} / ${evidence.candidates.length} eligible` },
  ]
  const weightedPreferences: readonly WeightedPreferenceItem[] = [
    { id: 'latency', label: 'Measured p95 latency', description: 'Faster delivery earns a higher normalized score.', weight: model.result.normalizedWeights.p95LatencyMs * 100, weightLabel: formatPercentage(model.result.normalizedWeights.p95LatencyMs) },
    { id: 'recovery', label: 'Measured recovery time', description: 'Faster recovery earns a higher normalized score.', weight: model.result.normalizedWeights.reconnectTimeMs * 100, weightLabel: formatPercentage(model.result.normalizedWeights.reconnectTimeMs) },
    { id: 'size', label: 'Measured implementation lines', description: 'Fewer relevant source lines reduce maintenance cost.', weight: model.result.normalizedWeights.implementationSizeLines * 100, weightLabel: formatPercentage(model.result.normalizedWeights.implementationSizeLines) },
    { id: 'complexity', label: 'Declared complexity', description: 'A lower human-defined factor is preferred.', weight: model.result.normalizedWeights.complexity * 100, weightLabel: formatPercentage(model.result.normalizedWeights.complexity) },
  ]

  const handleRun = async () => {
    if (runLock.current) return
    runLock.current = true
    setIsRunning(true)
    setBenchmarkError('')
    setFallbackConfirmed(false)
    try {
      const response = await fetch('/api/benchmark', { method: 'POST', headers: { accept: 'application/json' } })
      const payload: unknown = await response.json()
      if (!response.ok) {
        const message = typeof payload === 'object' && payload !== null && 'error' in payload ? String(payload.error) : `Benchmark endpoint returned HTTP ${response.status}.`
        throw new Error(message)
      }
      setEvidence(ingestBenchmarkEvidence(payload))
      setRunNumber((current) => current + 1)
    } catch (error) {
      setBenchmarkError(describeBenchmarkError(error))
    } finally {
      runLock.current = false
      setIsRunning(false)
    }
  }

  const handleFallback = () => {
    setEvidence(getPreparedFallback())
    setFallbackConfirmed(true)
    setBenchmarkError('')
  }

  const handleDownload = () => {
    const fileName = `adr-realtime-transport-${maximumLatency}ms.md`
    const blobUrl = URL.createObjectURL(new Blob([adrMarkdown], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = fileName
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(blobUrl)
    setExportFeedback(`Downloaded ${fileName}`)
  }
  const handleCopy = async () => {
    setIsCopying(true)
    try {
      const copied = navigator.clipboard ? await navigator.clipboard.writeText(adrMarkdown).then(() => true) : fallbackCopy(adrMarkdown)
      setExportFeedback(copied ? 'Markdown copied to the clipboard.' : 'Copy failed. Use Download ADR instead.')
    } catch {
      setExportFeedback(fallbackCopy(adrMarkdown) ? 'Markdown copied to the clipboard.' : 'Copy failed. Use Download ADR instead.')
    } finally { setIsCopying(false) }
  }
  const inspectWinner = () => {
    const ledger = document.querySelector<HTMLElement>('.blg-table-wrap')
    ledger?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ledger?.focus({ preventScroll: true })
  }
  const sse = evidence.candidates.find((candidate) => candidate.id === 'sse')
  const websocket = evidence.candidates.find((candidate) => candidate.id === 'websockets')
  const caveat = winner.id === 'sse'
    ? `A limit below ${winner.benchmark.p95LatencyMs} ms excludes this SSE implementation; the measured ${websocket?.benchmark.p95LatencyMs} ms WebSocket result then matters.`
    : `Meeting this tighter cap accepts ${winner.benchmark.implementationLines - (sse?.benchmark.implementationLines ?? 0)} additional measured lines and declared complexity ${winner.benchmark.complexity} instead of ${sse?.benchmark.complexity}.`
  const configurationSummary = (id: CandidateId) => Object.entries(evidence.configuration[id]).map(([key, value]) => `${key}=${value}`).join(' · ')
  const experimentState = isRunning ? 'running' : benchmarkError ? 'failed' : evidence.provenance.kind === 'live' ? 'complete' : 'idle'

  return (
    <div className="blg-dashboard">
      <a className="blg-skip-link" href="#decision-workspace">Skip to decision workspace</a>
      <AppHeader experimentId={runNumber > 0 ? `L-${String(runNumber).padStart(3, '0')}` : 'fixture'} onRunExperiment={handleRun} runLabel="Run experiment" isRunning={isRunning} />
      <main id="decision-workspace">
        <DecisionBrief
          title={evidence.title} question={evidence.question} context={evidence.context}
          metadata={[
            { label: 'Evidence', value: evidence.provenance.label },
            { label: 'Samples', value: `${evidence.sampleCount} per transport` },
            { label: 'Environment', value: `${evidence.environment.nodeVersion} · ${evidence.environment.os}` },
          ]}
        />

        <section className={`blg-provenance blg-provenance--${evidence.provenance.kind}`} aria-labelledby="provenance-title">
          <div><p className="blg-kicker">Evidence provenance</p><h2 id="provenance-title">{evidence.provenance.label}</h2><p>{evidence.provenance.evidenceSource}</p></div>
          <dl><div><dt>Timestamp</dt><dd>{formatTimestamp(evidence.timestamp)}</dd></div><div><dt>Samples</dt><dd>{evidence.sampleCount} per transport</dd></div><div><dt>Runtime</dt><dd>{evidence.environment.nodeVersion}</dd></div><div><dt>OS</dt><dd>{evidence.environment.os}</dd></div></dl>
          <details><summary>Repeatable configuration</summary><ul>{evidence.candidates.map((candidate) => <li key={candidate.id}><strong>{candidate.name}</strong> — {configurationSummary(candidate.id)}</li>)}</ul></details>
          <p className="blg-provenance__disclaimer">{evidence.disclaimer}</p>
        </section>

        <div className="blg-dashboard__workspace">
          {benchmarkError ? (
            <section className="blg-benchmark-error" role="alert"><div><strong>Local benchmark failed.</strong><p>{benchmarkError} The ledger still shows {evidence.provenance.label.toLowerCase()} and is not being relabeled.</p></div><button className="blg-button blg-button--tertiary" type="button" onClick={handleFallback}>Use prepared demonstration evidence</button></section>
          ) : null}
          {fallbackConfirmed ? <p className="blg-fallback-note" role="status">Prepared demonstration evidence selected intentionally. Run the experiment when the local endpoint is available.</p> : null}
          <section className="blg-constraint-lab" aria-labelledby="constraint-lab-title">
            <header className="blg-constraint-lab__header"><div><p className="blg-kicker">Live constraint</p><h2 id="constraint-lab-title">Stress-test the recommendation.</h2></div><div className="blg-presets" aria-label="Latency constraint presets">{LATENCY_PRESETS.map((preset) => <button key={preset} type="button" className="blg-preset" aria-pressed={maximumLatency === preset} onClick={() => setMaximumLatency(preset)}>{preset} ms</button>)}</div></header>
            <LatencyThresholdControl value={maximumLatency} min={100} max={900} step={10} onChange={setMaximumLatency} description="Move the hard limit or use a preset. Eligibility and scores recalculate immediately from the labeled evidence." />
          </section>
          <ExperimentStatus
            state={experimentState} completedRuns={isRunning ? 0 : 3} totalRuns={3}
            statusText={isRunning ? 'Measuring three local transports' : benchmarkError ? 'Live benchmark did not complete' : evidence.provenance.label}
            detail={isRunning ? 'Sending real loopback events. This normally takes about 10–15 seconds.' : benchmarkError ? 'Review the error or intentionally select the prepared fallback.' : `${winner.name} wins at the ${maximumLatency} ms limit from ${evidence.sampleCount} samples per transport.`}
            lastRunAt={evidence.provenance.kind === 'live' ? formatTimestamp(evidence.timestamp) : 'Prepared fixture'}
          />
          <div className="blg-dashboard__criteria-grid"><HardRequirementsPanel requirements={hardRequirements} /><WeightedPreferencesPanel preferences={weightedPreferences} maxWeight={100} /></div>
        </div>

        <div className="blg-result-announcement" aria-live="polite">At {maximumLatency} milliseconds, {winner.name} is recommended from {evidence.provenance.label}.</div>
        <CandidateSummaryCards candidates={candidateSummaries} winnerId={winner.id} />
        <EvidenceComparisonTable candidates={evidence.candidates.map((candidate) => ({ id: candidate.id, name: candidate.name, shortLabel: candidate.id === 'sse' ? 'SSE' : candidate.name }))} rows={evidenceRows} winnerId={winner.id} caption={`${evidence.provenance.label}: deterministic comparison with a ${maximumLatency} millisecond maximum measured p95 latency`} />
        <RecommendationPanel candidateName={winner.name} protocol={protocolLabels[winner.id]} score={formatScore(winnerEvaluation.weightedPreferenceScore)} headline={`${winner.name} is the defensible choice.`} rationale={model.result.explanation} evidence={reasons} caveat={caveat} onInspectCandidate={inspectWinner} />
        <div className="blg-dashboard__workspace blg-dashboard__workspace--export"><AdrExportAction onExport={handleDownload} onCopy={handleCopy} isExporting={isCopying} fileName={`adr-realtime-transport-${maximumLatency}ms.md`} buttonLabel="Download ADR" feedback={exportFeedback || undefined} /></div>
      </main>
      <footer className="blg-footer"><strong>Berlge</strong><span>{evidence.provenance.label} · deterministic scorer · local-only benchmark</span></footer>
    </div>
  )
}

export default App
