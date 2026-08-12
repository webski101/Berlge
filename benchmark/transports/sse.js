import { createServer } from 'node:http'
import { performance } from 'node:perf_hooks'

import {
  closeServer,
  listenOnTemporaryPort,
  trackServer,
} from '../runtime.js'

export const sseConfiguration = {
  deliveryCadenceMs: 150,
  recoveryDelayMs: 250,
  recoveryTrigger: 'server closes the event stream; client reconnects after fixed retry delay',
}

function readEventStream(response, onEvent) {
  const decoder = new TextDecoder()
  let buffer = ''
  return (async () => {
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const packet = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const data = packet.split('\n').find((line) => line.startsWith('data: '))
        if (data) onEvent(JSON.parse(data.slice(6)))
        boundary = buffer.indexOf('\n\n')
      }
    }
  })()
}

export async function runSseBenchmark(sampleCount) {
  const clients = new Set()
  const queue = []
  let sendRecoveryOnConnect = false
  const server = trackServer(
    createServer((request, response) => {
      if (request.url !== '/events') {
        response.writeHead(404).end()
        return
      }
      response.writeHead(200, {
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'content-type': 'text/event-stream',
      })
      response.write(`retry: ${sseConfiguration.recoveryDelayMs}\n\n`)
      clients.add(response)
      response.once('close', () => clients.delete(response))
      if (sendRecoveryOnConnect) {
        sendRecoveryOnConnect = false
        response.write(`data: ${JSON.stringify({ id: 'recovery' })}\n\n`)
      }
    }),
  )
  const flushTimer = setInterval(() => {
    for (const event of queue.splice(0)) {
      const packet = `data: ${JSON.stringify(event)}\n\n`
      for (const client of clients) client.write(packet)
    }
  }, sseConfiguration.deliveryCadenceMs)

  let successful = 0
  const latencies = []
  try {
    const port = await listenOnTemporaryPort(server)
    const url = `http://127.0.0.1:${port}/events`
    let resolveRecovery
    const recovery = new Promise((resolve) => { resolveRecovery = resolve })
    const received = new Map()
    const connect = async () => {
      const response = await fetch(url)
      readEventStream(response, (event) => {
        if (event.id === 'recovery') resolveRecovery(performance.now())
        else received.get(event.id)?.(performance.now())
      }).catch(() => {})
    }
    await connect()

    for (let index = 0; index < sampleCount; index += 1) {
      const deliveredAt = new Promise((resolve) => received.set(index, resolve))
      const createdAt = performance.now()
      queue.push({ id: index, createdAt })
      const arrivedAt = await deliveredAt
      received.delete(index)
      successful += 1
      latencies.push(arrivedAt - createdAt)
    }

    const recoveryStartedAt = performance.now()
    sendRecoveryOnConnect = true
    for (const client of [...clients]) client.end()
    await new Promise((resolve) => setTimeout(resolve, sseConfiguration.recoveryDelayMs))
    await connect()
    const recoveredAt = await recovery

    return {
      deliveries: { successful, failed: sampleCount - successful, total: sampleCount },
      latencies,
      recoveryTimeMs: recoveredAt - recoveryStartedAt,
    }
  } finally {
    clearInterval(flushTimer)
    for (const client of clients) client.end()
    await closeServer(server)
  }
}

