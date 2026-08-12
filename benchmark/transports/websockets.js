import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { performance } from 'node:perf_hooks'

import {
  closeServer,
  listenOnTemporaryPort,
  sleep,
  trackServer,
} from '../runtime.js'

export const websocketConfiguration = {
  deliveryCadenceMs: 20,
  recoveryDelayMs: 400,
  recoveryTrigger: 'server closes the socket; application reconnects after fixed backoff',
}

function encodeTextFrame(value) {
  const payload = Buffer.from(JSON.stringify(value))
  return Buffer.concat([Buffer.from([0x81, payload.length]), payload])
}

function decodeMaskedFrames(buffer, onMessage) {
  let offset = 0
  while (buffer.length - offset >= 6) {
    const length = buffer[offset + 1] & 0x7f
    if (length >= 126 || buffer.length - offset < length + 6) break
    const mask = buffer.subarray(offset + 2, offset + 6)
    const payload = buffer.subarray(offset + 6, offset + 6 + length)
    for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4]
    onMessage(JSON.parse(payload.toString()))
    offset += length + 6
  }
  return buffer.subarray(offset)
}

export async function runWebsocketBenchmark(sampleCount) {
  const sockets = new Set()
  const queue = []
  let sendRecoveryOnConnect = false
  const server = trackServer(createServer())
  server.on('upgrade', (request, socket) => {
    const accept = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64')
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
    let buffer = Buffer.alloc(0)
    socket.on('data', (chunk) => {
      buffer = decodeMaskedFrames(Buffer.concat([buffer, chunk]), (event) => queue.push(event))
    })
    if (sendRecoveryOnConnect) {
      sendRecoveryOnConnect = false
      socket.write(encodeTextFrame({ id: 'recovery' }))
    }
  })
  const flushTimer = setInterval(() => {
    for (const event of queue.splice(0)) {
      for (const socket of sockets) socket.write(encodeTextFrame(event))
    }
  }, websocketConfiguration.deliveryCadenceMs)

  let client
  let successful = 0
  const latencies = []
  try {
    const port = await listenOnTemporaryPort(server)
    const url = `ws://127.0.0.1:${port}`
    const received = new Map()
    let resolveRecovery
    const recovery = new Promise((resolve) => { resolveRecovery = resolve })
    const connect = () => new Promise((resolve, reject) => {
      const socket = new WebSocket(url)
      socket.addEventListener('open', () => resolve(socket), { once: true })
      socket.addEventListener('error', () => reject(new Error('WebSocket connection failed.')), { once: true })
      socket.addEventListener('message', (message) => {
        const event = JSON.parse(message.data)
        if (event.id === 'recovery') resolveRecovery(performance.now())
        else received.get(event.id)?.(performance.now())
      })
    })
    client = await connect()

    for (let index = 0; index < sampleCount; index += 1) {
      const deliveredAt = new Promise((resolve) => received.set(index, resolve))
      const createdAt = performance.now()
      client.send(JSON.stringify({ id: index, createdAt, nonce: randomBytes(4).toString('hex') }))
      const arrivedAt = await deliveredAt
      received.delete(index)
      successful += 1
      latencies.push(arrivedAt - createdAt)
    }

    const recoveryStartedAt = performance.now()
    sendRecoveryOnConnect = true
    for (const socket of [...sockets]) socket.destroy()
    await sleep(websocketConfiguration.recoveryDelayMs)
    client = await connect()
    const recoveredAt = await recovery

    return {
      deliveries: { successful, failed: sampleCount - successful, total: sampleCount },
      latencies,
      recoveryTimeMs: recoveredAt - recoveryStartedAt,
    }
  } finally {
    clearInterval(flushTimer)
    client?.close()
    for (const socket of sockets) socket.destroy()
    await closeServer(server)
  }
}

