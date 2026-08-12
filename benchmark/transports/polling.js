import { createServer } from 'node:http'
import { performance } from 'node:perf_hooks'

import {
  closeServer,
  listenOnTemporaryPort,
  sleep,
  trackServer,
} from '../runtime.js'

export const pollingConfiguration = {
  deliveryCadenceMs: 600,
  recoveryDelayMs: 600,
  recoveryTrigger: 'one forced HTTP 503 followed by the next scheduled poll',
}

export async function runPollingBenchmark(sampleCount) {
  const events = []
  let failNextPoll = false
  const server = trackServer(
    createServer((request, response) => {
      if (request.url === '/events') {
        if (failNextPoll) {
          failNextPoll = false
          response.writeHead(503).end()
          return
        }
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify(events.splice(0)))
        return
      }
      response.writeHead(404).end()
    }),
  )

  let successful = 0
  const latencies = []
  try {
    const port = await listenOnTemporaryPort(server)
    const url = `http://127.0.0.1:${port}/events`
    for (let index = 0; index < sampleCount; index += 1) {
      const createdAt = performance.now()
      events.push({ id: index, createdAt })
      await sleep(pollingConfiguration.deliveryCadenceMs)
      const response = await fetch(url)
      const delivered = await response.json()
      const event = delivered.find((candidate) => candidate.id === index)
      if (event) {
        successful += 1
        latencies.push(performance.now() - event.createdAt)
      }
    }

    failNextPoll = true
    const recoveryStartedAt = performance.now()
    events.push({ id: 'recovery', createdAt: recoveryStartedAt })
    await fetch(url)
    await sleep(pollingConfiguration.recoveryDelayMs)
    const recovered = await (await fetch(url)).json()
    if (!recovered.some((event) => event.id === 'recovery')) {
      throw new Error('Polling did not deliver its recovery probe.')
    }

    return {
      deliveries: { successful, failed: sampleCount - successful, total: sampleCount },
      latencies,
      recoveryTimeMs: performance.now() - recoveryStartedAt,
    }
  } finally {
    await closeServer(server)
  }
}

