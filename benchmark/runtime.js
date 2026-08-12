const activeServers = new Set()

export function trackServer(server) {
  activeServers.add(server)
  server.once('close', () => activeServers.delete(server))
  return server
}

export function activeServerCount() {
  return activeServers.size
}

export function listenOnTemporaryPort(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      const address = server.address()
      if (address === null || typeof address === 'string') {
        reject(new Error('Benchmark server did not receive a TCP port.'))
        return
      }
      resolve(address.port)
    })
  })
}

export function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve()
      return
    }
    server.close((error) => (error ? reject(error) : resolve()))
    server.closeAllConnections?.()
  })
}

export const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

