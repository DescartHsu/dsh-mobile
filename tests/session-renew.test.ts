import { describe, expect, it } from 'vitest'
import { csrfToken, shouldRenewSession } from '../src/client.js'

/**
 * A restarted host invalidates the WebView's session cookie, and the browser has
 * no device credential to mint another one — so the client's endless mux retries
 * can never succeed. The app holds the credential and can renew on request; the
 * page asks once the connection has stayed down long enough to rule out a blip.
 */

describe('session renew', () => {
  it('asks once the connection has stayed down past the window', () => {
    expect(shouldRenewSession('connecting', 5000)).toBe(true)
    expect(shouldRenewSession('disconnected', 6000)).toBe(true)
  })

  it('stays quiet during a brief blip', () => {
    expect(shouldRenewSession('connecting', 4999)).toBe(false)
    expect(shouldRenewSession(undefined, 0)).toBe(false)
  })

  it('never asks while the connection is healthy', () => {
    expect(shouldRenewSession('connected', 60_000)).toBe(false)
  })
})

describe('csrf token', () => {
  it('reads the mobile csrf cookie', () => {
    const stub = { cookie: 'dsh_ma_session=abc; dsh_ma_csrf=token-123' }
    const original = (globalThis as { document?: unknown }).document
    ;(globalThis as { document?: unknown }).document = stub
    try {
      expect(csrfToken()).toBe('token-123')
    } finally {
      ;(globalThis as { document?: unknown }).document = original
    }
  })

  it('returns undefined without a document or cookie', () => {
    expect(csrfToken()).toBeUndefined()
  })
})
