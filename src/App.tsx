import { useEffect, useMemo, useRef, useState } from 'react'

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
import { preparedRealtimeDecision } from './data/index.ts'
import { formatPercentage, generateAdrMarkdown } from './lib/index.ts'
import {
  createAdrInput,
  createRealtimeDecision,
  decisionReasons,
  evaluationFor,
  type RealtimeDecisionModel,
} from './app/decisionModel.ts'
import './styles/app.css'

const DECISION_DATE = '2026-08-12'
const LATENCY_PRESETS = [500, 100] as const

const protocolLabels: Record<CandidateId, string> = {
  polling: 'HTTP interval',
  sse: 'HTTP event stream',
  websockets: 'Full-duplex socket',
}

function formatScore(score: number): string {
  return score.toFixed(3)
}

function cellsFor(
  factory: (candidateId: CandidateId) => EvidenceCellData,
): Record<CandidateId, EvidenceCellData> {
  return Object.fromEntries(
    preparedRealtimeDecision.candidates.map((candidate) => [
      candidate.id,
      factory(candidate.id),
    ]),
  ) as Record<CandidateId, EvidenceCellData>
}

function bestEligibleId(
  model: RealtimeDecisionModel,
  metric:
    | 'p95LatencyMs'
    | 'reconnectTimeMs'
    | 'implementationSizeLines'
    | 'complexity',
): CandidateId | undefined {
  return model.input.candidates
    .filter((candidate) => evaluationFor(model, candidate.id).eligible)
    .sort((left, right) => left.metrics[metric] - right.metrics[metric])[0]
    ?.id as CandidateId | undefined
}

function buildEvidenceRows(
  model: RealtimeDecisionModel,
): readonly EvidenceRowData[] {
  const candidatesById = new Map(
    preparedRealtimeDecision.candidates.map((candidate) => [
      candidate.id,
      candidate,
    ]),
  )
  const bestP95 = bestEligibleId(model, 'p95LatencyMs')
  const bestReconnect = bestEligibleId(model, 'reconnectTimeMs')
  const bestSize = bestEligibleId(model, 'implementationSizeLines')
  const bestComplexity = bestEligibleId(model, 'complexity')

  const candidateFor = (candidateId: CandidateId) => {
    const candidate = candidatesById.get(candidateId)
    if (candidate === undefined) {
      throw new Error(`Missing prepared candidate: ${candidateId}`)
    }
    return candidate
  }

  return [
    {
      id: 'tests',
      label: 'Test suite',
      description: 'All prepared tests must pass',
      kind: 'constraint',
      values: cellsFor((candidateId) => {
        const benchmark = candidateFor(candidateId).benchmark
        const passes = benchmark.testsPassed === benchmark.testsTotal
        return {
          value: `${benchmark.testsPassed}/${benchmark.testsTotal}`,
          detail: passes ? 'All tests passed' : 'Hard constraint violated',
          status: passes ? 'pass' : 'fail',
          statusLabel: passes ? 'Pass' : 'Fail',
        }
      }),
    },
    {
      id: 'p95-latency',
      label: 'p95 latency',
      description: `Hard limit: at most ${model.maximumP95LatencyMs} ms`,
      kind: 'constraint',
      values: cellsFor((candidateId) => {
        const candidate = candidateFor(candidateId)
        const evaluation = evaluationFor(model, candidateId)
        return {
          value: `${candidate.benchmark.p95LatencyMs} ms`,
          detail: evaluation.eligible
            ? `${model.maximumP95LatencyMs - candidate.benchmark.p95LatencyMs} ms headroom`
            : evaluation.violations[0]?.message,
          status: evaluation.eligible ? 'pass' : 'fail',
          statusLabel: evaluation.eligible ? 'Eligible' : 'Violation',
          isBest: candidateId === bestP95,
        }
      }),
    },
    {
      id: 'reconnect',
      label: 'Reconnect time',
      description: 'Lower is preferred · 15% weight',
      values: cellsFor((candidateId) => ({
        value: `${candidateFor(candidateId).benchmark.reconnectMs} ms`,
        isBest: candidateId === bestReconnect,
      })),
    },
    {
      id: 'implementation-size',
      label: 'Implementation size',
      description: 'Lower is preferred · 35% weight',
      values: cellsFor((candidateId) => ({
        value: `${candidateFor(candidateId).benchmark.implementationLines} lines`,
        isBest: candidateId === bestSize,
      })),
    },
    {
      id: 'complexity',
      label: 'Complexity',
      description: 'Lower is preferred · 35% weight',
      values: cellsFor((candidateId) => ({
        value: String(candidateFor(candidateId).benchmark.complexity),
        detail: 'Shared ordinal scale',
        isBest: candidateId === bestComplexity,
      })),
    },
    {
      id: 'weighted-score',
      label: 'Weighted score',
      description: 'Calculated after normalization; hard gates take precedence',
      kind: 'score',
      values: cellsFor((candidateId) => {
        const evaluation = evaluationFor(model, candidateId)
        return {
          value: formatScore(evaluation.weightedPreferenceScore),
          detail: evaluation.eligible ? 'Ranked' : 'Excluded by hard gate',
          status: evaluation.eligible ? 'pass' : 'fail',
          statusLabel: evaluation.eligible ? 'Ranked' : 'Excluded',
          isBest: candidateId === model.result.winnerId,
        }
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
  const [isRunning, setIsRunning] = useState(false)
  const [runNumber, setRunNumber] = useState(1)
  const [exportFeedback, setExportFeedback] = useState('')
  const [isCopying, setIsCopying] = useState(false)
  const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (runTimer.current !== null) clearTimeout(runTimer.current)
    },
    [],
  )

  const model = useMemo(
    () => createRealtimeDecision(maximumLatency),
    [maximumLatency],
  )
  const adrMarkdown = useMemo(
    () => generateAdrMarkdown(createAdrInput(model, DECISION_DATE)),
    [model],
  )
  const reasons = useMemo(() => decisionReasons(model), [model])
  const evidenceRows = useMemo(() => buildEvidenceRows(model), [model])

  const winner = model.winner
  if (winner === null) {
    throw new Error('The configured latency range must retain an eligible option.')
  }
  const winnerEvaluation = evaluationFor(model, winner.id)
  const eligibleCount = model.result.evaluations.filter(
    (evaluation) => evaluation.eligible,
  ).length
  const totalTests = preparedRealtimeDecision.candidates.reduce(
    (total, candidate) => total + candidate.benchmark.testsTotal,
    0,
  )
  const passedTests = preparedRealtimeDecision.candidates.reduce(
    (total, candidate) => total + candidate.benchmark.testsPassed,
    0,
  )

  const candidateSummaries: readonly CandidateSummaryData[] =
    preparedRealtimeDecision.candidates.map((candidate) => {
      const evaluation = evaluationFor(model, candidate.id)
      return {
        id: candidate.id,
        name: candidate.name,
        protocol: protocolLabels[candidate.id],
        description: candidate.description,
        eligibility: evaluation.eligible ? 'eligible' : 'ineligible',
        violations: evaluation.violations.map(
          (violation) => violation.message,
        ),
        weightedScore: formatScore(evaluation.weightedPreferenceScore),
        metrics: {
          tests: `${candidate.benchmark.testsPassed}/${candidate.benchmark.testsTotal}`,
          p95Latency: `${candidate.benchmark.p95LatencyMs} ms`,
          reconnect: `${candidate.benchmark.reconnectMs} ms`,
          lines: String(candidate.benchmark.implementationLines),
          complexity: String(candidate.benchmark.complexity),
        },
      }
    })

  const hardRequirements: readonly HardRequirementItem[] = [
    {
      id: 'all-tests-pass',
      label: 'All benchmark tests pass',
      description: 'Failures remove a candidate before preference scoring.',
      status: passedTests === totalTests ? 'pass' : 'fail',
      result: `${passedTests} / ${totalTests} passed`,
    },
    {
      id: 'maximum-latency',
      label: `p95 latency ≤ ${maximumLatency} ms`,
      description: 'The active latency ceiling is a hard gate, not a weight.',
      status: eligibleCount > 0 ? 'pass' : 'fail',
      result: `${eligibleCount} / ${preparedRealtimeDecision.candidates.length} eligible`,
    },
  ]

  const weightedPreferences: readonly WeightedPreferenceItem[] = [
    {
      id: 'latency',
      label: 'p95 latency',
      description: 'Faster delivery earns a higher normalized score.',
      weight: model.result.normalizedWeights.p95LatencyMs * 100,
      weightLabel: formatPercentage(model.result.normalizedWeights.p95LatencyMs),
    },
    {
      id: 'reconnect',
      label: 'Reconnect time',
      description: 'Faster recovery earns a higher normalized score.',
      weight: model.result.normalizedWeights.reconnectTimeMs * 100,
      weightLabel: formatPercentage(model.result.normalizedWeights.reconnectTimeMs),
    },
    {
      id: 'size',
      label: 'Implementation size',
      description: 'Fewer owned lines reduce maintenance cost.',
      weight: model.result.normalizedWeights.implementationSizeLines * 100,
      weightLabel: formatPercentage(
        model.result.normalizedWeights.implementationSizeLines,
      ),
    },
    {
      id: 'complexity',
      label: 'Complexity',
      description: 'Simpler operational behavior is preferred.',
      weight: model.result.normalizedWeights.complexity * 100,
      weightLabel: formatPercentage(model.result.normalizedWeights.complexity),
    },
  ]

  const handleRun = () => {
    if (runTimer.current !== null) clearTimeout(runTimer.current)
    setIsRunning(true)
    runTimer.current = setTimeout(() => {
      setIsRunning(false)
      setRunNumber((current) => current + 1)
      runTimer.current = null
    }, 650)
  }

  const handleDownload = () => {
    const fileName = `adr-realtime-transport-${maximumLatency}ms.md`
    const blobUrl = URL.createObjectURL(
      new Blob([adrMarkdown], { type: 'text/markdown;charset=utf-8' }),
    )
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
      const copied = navigator.clipboard
        ? await navigator.clipboard.writeText(adrMarkdown).then(() => true)
        : fallbackCopy(adrMarkdown)
      setExportFeedback(
        copied ? 'Markdown copied to the clipboard.' : 'Copy failed. Use Download ADR instead.',
      )
    } catch {
      const copied = fallbackCopy(adrMarkdown)
      setExportFeedback(
        copied ? 'Markdown copied to the clipboard.' : 'Copy failed. Use Download ADR instead.',
      )
    } finally {
      setIsCopying(false)
    }
  }

  const inspectWinner = () => {
    const ledger = document.querySelector<HTMLElement>('.blg-table-wrap')
    ledger?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ledger?.focus({ preventScroll: true })
  }

  const sse = preparedRealtimeDecision.candidates.find(
    (candidate) => candidate.id === 'sse',
  )
  const caveat =
    winner.id === 'sse'
      ? `A limit below ${winner.benchmark.p95LatencyMs} ms excludes SSE; the ${preparedRealtimeDecision.candidates.find((candidate) => candidate.id === 'websockets')?.benchmark.p95LatencyMs} ms WebSockets result then becomes decisive.`
      : `Meeting this tighter cap accepts ${winner.benchmark.implementationLines - (sse?.benchmark.implementationLines ?? 0)} additional lines and complexity ${winner.benchmark.complexity} instead of ${sse?.benchmark.complexity}.`

  return (
    <div className="blg-dashboard">
      <a className="blg-skip-link" href="#decision-workspace">
        Skip to decision workspace
      </a>
      <AppHeader
        experimentId={`D-${String(runNumber).padStart(3, '0')}`}
        onRunExperiment={handleRun}
        runLabel="Re-run scoring"
        isRunning={isRunning}
      />

      <main id="decision-workspace">
        <DecisionBrief
          title={preparedRealtimeDecision.title}
          question={preparedRealtimeDecision.question}
          context={preparedRealtimeDecision.context}
          metadata={[
            { label: 'Evidence', value: 'Prepared fixture v1' },
            { label: 'Decision date', value: DECISION_DATE },
            { label: 'Active limit', value: `${maximumLatency} ms p95` },
          ]}
        />

        <div className="blg-dashboard__workspace">
          <section className="blg-constraint-lab" aria-labelledby="constraint-lab-title">
            <header className="blg-constraint-lab__header">
              <div>
                <p className="blg-kicker">Live constraint</p>
                <h2 id="constraint-lab-title">Stress-test the recommendation.</h2>
              </div>
              <div className="blg-presets" aria-label="Latency constraint presets">
                {LATENCY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="blg-preset"
                    aria-pressed={maximumLatency === preset}
                    onClick={() => setMaximumLatency(preset)}
                  >
                    {preset} ms
                  </button>
                ))}
              </div>
            </header>
            <LatencyThresholdControl
              value={maximumLatency}
              min={100}
              max={900}
              step={10}
              onChange={setMaximumLatency}
              description="Move the hard limit or use a preset. Eligibility and scores recalculate immediately in TypeScript."
            />
          </section>

          <ExperimentStatus
            state={isRunning ? 'running' : 'complete'}
            completedRuns={isRunning ? 2 : 3}
            totalRuns={3}
            statusText={isRunning ? 'Replaying prepared evidence' : 'Deterministic scoring complete'}
            detail={isRunning ? 'Re-evaluating hard gates and normalized weights.' : `${winner.name} wins at the ${maximumLatency} ms limit.`}
            lastRunAt="Local · no network"
          />

          <div className="blg-dashboard__criteria-grid">
            <HardRequirementsPanel requirements={hardRequirements} />
            <WeightedPreferencesPanel
              preferences={weightedPreferences}
              maxWeight={100}
            />
          </div>
        </div>

        <div className="blg-result-announcement" aria-live="polite">
          At {maximumLatency} milliseconds, {winner.name} is recommended.
        </div>

        <CandidateSummaryCards
          candidates={candidateSummaries}
          winnerId={winner.id}
        />

        <EvidenceComparisonTable
          candidates={preparedRealtimeDecision.candidates.map((candidate) => ({
            id: candidate.id,
            name: candidate.name,
            shortLabel: candidate.id === 'sse' ? 'SSE' : candidate.name,
          }))}
          rows={evidenceRows}
          winnerId={winner.id}
          caption={`Deterministic comparison with a ${maximumLatency} millisecond maximum p95 latency`}
        />

        <RecommendationPanel
          candidateName={winner.name}
          protocol={protocolLabels[winner.id]}
          score={formatScore(winnerEvaluation.weightedPreferenceScore)}
          headline={`${winner.name} is the defensible choice.`}
          rationale={model.result.explanation}
          evidence={reasons}
          caveat={caveat}
          onInspectCandidate={inspectWinner}
        />

        <div className="blg-dashboard__workspace blg-dashboard__workspace--export">
          <AdrExportAction
            onExport={handleDownload}
            onCopy={handleCopy}
            isExporting={isCopying}
            fileName={`adr-realtime-transport-${maximumLatency}ms.md`}
            buttonLabel="Download ADR"
            feedback={exportFeedback || undefined}
          />
        </div>
      </main>

      <footer className="blg-footer">
        <strong>Berlge</strong>
        <span>Prepared evidence · deterministic TypeScript · zero network calls</span>
      </footer>
    </div>
  )
}

export default App
