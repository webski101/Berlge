import { runBenchmark } from './runner.js'

export function localBenchmarkApi() {
  return {
    name: 'berlge-local-benchmark-api',
    configureServer(server) {
      server.middlewares.use('/api/benchmark', async (request, response) => {
        response.setHeader('content-type', 'application/json')
        const remoteAddress = request.socket.remoteAddress
        const isLoopback = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1'
        if (!isLoopback) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: 'The benchmark endpoint accepts loopback clients only.' }))
          return
        }
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end(JSON.stringify({ error: 'Use POST to run the local benchmark.' }))
          return
        }
        try {
          response.end(JSON.stringify(await runBenchmark()))
        } catch (error) {
          response.statusCode = 500
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Benchmark failed.' }))
        }
      })
    },
  }
}
