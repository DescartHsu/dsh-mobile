import { expect, it } from 'vitest'
import { acquireUdpDiscoveryGateway } from './udp-discovery-fixture.js'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(complete => { resolve = complete })
  return { promise, resolve }
}

function candidate(port: number, status: { broadcast: boolean; mdns: boolean; errorCode?: string }, close = async () => {}) {
  return {
    address: () => ({ host: '127.0.0.1', port, origin: `http://127.0.0.1:${port}` }),
    discoveryStatus: () => status,
    close,
  }
}

it('keeps the first gateway that owns UDP without closing or restarting it', async () => {
  let starts = 0
  let closes = 0
  const ready = candidate(40001, { broadcast: true, mdns: true }, async () => { closes += 1 })
  expect(await acquireUdpDiscoveryGateway(async () => { starts += 1; return ready })).toBe(ready)
  expect({ starts, closes }).toEqual({ starts: 1, closes: 0 })
})

it.each(['EADDRINUSE', 'EACCES'])('awaits rejected %s bind cleanup before starting its successor', async code => {
  const closing = deferred()
  const release = deferred()
  let starts = 0
  const ready = candidate(40002, { broadcast: true, mdns: true })
  const acquired = acquireUdpDiscoveryGateway(async () => {
    starts += 1
    return starts === 1
      ? candidate(40001, { broadcast: false, mdns: true, errorCode: `discovery_broadcast_${code}` }, async () => {
        closing.resolve()
        await release.promise
      })
      : ready
  })
  await closing.promise
  expect(starts).toBe(1)
  release.resolve()
  expect(await acquired).toBe(ready)
  expect(starts).toBe(2)
})

it.each([
  { broadcast: false, errorCode: undefined, notify: false },
  { broadcast: false, errorCode: 'discovery_broadcast_ENETDOWN', notify: false },
  { broadcast: false, errorCode: 'discovery_broadcast_EACCES', notify: true },
  { broadcast: false, errorCode: 'discovery_broadcast_EADDRINUSE', notify: true },
  { broadcast: true, errorCode: 'discovery_broadcast_EACCES', notify: false },
])('fails without another candidate for unknown or post-bind discovery state %j', async entry => {
  let starts = 0
  let closes = 0
  await expect(acquireUdpDiscoveryGateway(async observe => {
    starts += 1
    if (entry.notify) observe('broadcast', entry.errorCode!)
    return candidate(40001, {
      broadcast: entry.broadcast, mdns: true,
      ...(entry.errorCode === undefined ? {} : { errorCode: entry.errorCode }),
    }, async () => { closes += 1 })
  })).rejects.toThrow('not a bind conflict')
  expect({ starts, closes }).toEqual({ starts: 1, closes: 1 })
})

it('reports all four failed resource acquisitions without replaying a consumer', async () => {
  let starts = 0
  let closes = 0
  await expect(acquireUdpDiscoveryGateway(async () => {
    starts += 1
    return candidate(40000 + starts, { broadcast: false, mdns: true, errorCode: 'discovery_broadcast_EADDRINUSE' }, async () => { closes += 1 })
  })).rejects.toThrow('could not acquire both listeners')
  expect({ starts, closes }).toEqual({ starts: 4, closes: 4 })
})

it('does not start another candidate after cleanup fails', async () => {
  let starts = 0
  await expect(acquireUdpDiscoveryGateway(async () => {
    starts += 1
    return candidate(40001, { broadcast: false, mdns: true, errorCode: 'discovery_broadcast_EADDRINUSE' }, async () => { throw new Error('close failed') })
  })).rejects.toThrow('did not close')
  expect(starts).toBe(1)
})

it('does not replay startup failures', async () => {
  let starts = 0
  await expect(acquireUdpDiscoveryGateway(async () => { starts += 1; throw new Error('start failed') })).rejects.toThrow('start failed')
  expect(starts).toBe(1)
})
