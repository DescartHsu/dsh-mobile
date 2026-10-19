import { describe, expect, it } from 'vitest'
import { rewriteClientBundleBody } from '../src/gateway.js'

/**
 * The rewrite is the whole feature: it lets the plugin halve the history page a
 * mobile client asks for without touching a core file. These cases pin the two
 * behaviours that matter — it actually rewrites the history constant, and it
 * leaves every other bundle byte-identical.
 */

const MODULE = '@deepseek-ai/dsh-api-session-controller/client.js'

/** The shape the upstream bundle actually ships (tabs, nested object). */
function upstreamBundle(maxMessages = 500, minMessages = 50, minTurns = 2): string {
  return [
    'const HISTORY_PAGE_OPTIONS = {',
    `\t\t\tmaxMessages: ${String(maxMessages)},`,
    '\t\t\tturnWindow: {',
    `\t\t\t\tminMessages: ${String(minMessages)},`,
    `\t\t\t\tminTurns: ${String(minTurns)}`,
    '\t\t\t}',
    '\t\t};',
    'const OTHER = { maxMessages: 500 };',
  ].join('\n')
}

describe('mobile client bundle rewrite', () => {
  it('halves the history page the client asks for', () => {
    const rewritten = rewriteClientBundleBody(MODULE, Buffer.from(upstreamBundle())).toString('utf8')
    expect(rewritten).toContain('maxMessages: 240,')
    expect(rewritten).toContain('turnWindow: { minMessages: 24, minTurns: 1')
    expect(rewritten).not.toContain('maxMessages: 500,')
    // A constant outside the anchored object must survive untouched.
    expect(rewritten).toContain('const OTHER = { maxMessages: 500 };')
  })

  it('leaves other bundles byte-identical', () => {
    const body = Buffer.from(upstreamBundle())
    expect(rewriteClientBundleBody('@deepseek-ai/dsh-client-ui-chat/client.js', body)).toBe(body)
  })

  it('returns the original when the upstream anchor changes', () => {
    const body = Buffer.from('const HISTORY_PAGE_OPTIONS = { maxPages: 3 };')
    expect(rewriteClientBundleBody(MODULE, body)).toBe(body)
  })
})
