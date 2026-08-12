export const HOSTED_DEMO_MESSAGE = 'Live experiments run locally. This hosted demo uses prepared demonstration evidence.'
export const LOCAL_BENCHMARK_INSTRUCTIONS = 'Clone the repository and run npm install, then npm run dev, to execute the real local benchmark.'

export interface BenchmarkAvailability {
  canRun: boolean
  runLabel: string
}

type BenchmarkFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

class BenchmarkRequestError extends Error {
  readonly userMessage: string

  constructor(userMessage: string) {
    super(userMessage)
    this.name = 'BenchmarkRequestError'
    this.userMessage = userMessage
  }
}

export function getBenchmarkAvailability(isDevelopment: boolean): BenchmarkAvailability {
  return isDevelopment
    ? { canRun: true, runLabel: 'Run experiment' }
    : { canRun: false, runLabel: 'Local benchmark only' }
}

function unavailableMessage(context: string): string {
  return `${context} ${HOSTED_DEMO_MESSAGE} ${LOCAL_BENCHMARK_INSTRUCTIONS}`
}

function isHtmlResponse(contentType: string, body: string): boolean {
  return contentType.includes('text/html') || /^\s*(?:<!doctype\s+html|<html\b)/i.test(body)
}

function httpFailureMessage(response: Response, isHtml: boolean): string {
  const status = `HTTP ${response.status}`

  if (isHtml || response.status === 404 || response.status === 405) {
    return unavailableMessage(`The local benchmark endpoint is unavailable (${status}).`)
  }

  if (response.status === 403) {
    return `The local benchmark endpoint refused the request (${status}). Open the Vite URL from this computer and try again.`
  }

  return `The local benchmark endpoint reported an error (${status}). Restart the Vite development server and try again.`
}

export async function requestBenchmarkEvidence(fetchBenchmark: BenchmarkFetch = fetch): Promise<unknown> {
  let response: Response
  try {
    response = await fetchBenchmark('/api/benchmark', {
      method: 'POST',
      headers: { accept: 'application/json' },
    })
  } catch {
    throw new BenchmarkRequestError(unavailableMessage('The local benchmark endpoint could not be reached.'))
  }

  let body: string
  try {
    body = await response.text()
  } catch {
    throw new BenchmarkRequestError('The local benchmark response could not be read. Restart the Vite development server and try again.')
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const html = isHtmlResponse(contentType, body)

  if (!response.ok) {
    throw new BenchmarkRequestError(httpFailureMessage(response, html))
  }

  if (html) {
    throw new BenchmarkRequestError(unavailableMessage('The local benchmark endpoint returned the hosted page instead of benchmark evidence.'))
  }

  if (body.trim() === '') {
    throw new BenchmarkRequestError('The local benchmark returned an empty response. Restart the Vite development server and try again.')
  }

  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new BenchmarkRequestError('The local benchmark returned an unreadable response. Restart the Vite development server and try again.')
  }
}

export function describeBenchmarkError(error: unknown): string {
  if (error instanceof BenchmarkRequestError) return error.userMessage
  return 'The benchmark returned evidence Berlge could not validate. The current labeled evidence is unchanged.'
}
