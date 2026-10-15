import type { MobileAccessGateway } from '../src/gateway.js'

type Candidate = Pick<MobileAccessGateway, 'address' | 'discoveryStatus' | 'close'>
type DiscoveryObserver = (source: 'broadcast' | 'mdns', code: string) => void

const MAX_CANDIDATES = 4
const BIND_CONFLICTS = new Set(['discovery_broadcast_EADDRINUSE', 'discovery_broadcast_EACCES'])

/** Acquire a started gateway that keeps both listeners; rejected candidates close before another starts. */
export async function acquireUdpDiscoveryGateway<T extends Candidate>(
  start: (observe: DiscoveryObserver) => Promise<T>,
): Promise<T> {
  const attempts: Array<{
    readonly port: number
    readonly status: ReturnType<Candidate['discoveryStatus']>
    readonly broadcastNotifications: readonly string[]
  }> = []
  for (let attempt = 0; attempt < MAX_CANDIDATES; attempt += 1) {
    const broadcastNotifications: string[] = []
    const candidate = await start((source, code) => {
      if (source === 'broadcast') broadcastNotifications.push(code)
    })
    const status = candidate.discoveryStatus()
    attempts.push({ port: candidate.address().port, status, broadcastNotifications: [...broadcastNotifications] })
    if (status.broadcast && status.errorCode === undefined && broadcastNotifications.length === 0) return candidate

    // Initial bind failure is silent; setBroadcast/send/running failures notify and must not be retried.
    const bindConflict = !status.broadcast && status.errorCode !== undefined
      && BIND_CONFLICTS.has(status.errorCode) && broadcastNotifications.length === 0
    try {
      await candidate.close()
    } catch (error) {
      throw new Error(`UDP fixture candidate did not close: ${JSON.stringify(attempts)}`, { cause: error })
    }
    if (!bindConflict) throw new Error(`UDP fixture discovery is not a bind conflict: ${JSON.stringify(attempts)}`)
  }
  throw new Error(`UDP fixture could not acquire both listeners: ${JSON.stringify(attempts)}`)
}
