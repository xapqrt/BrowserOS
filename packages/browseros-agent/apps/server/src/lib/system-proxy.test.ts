import { describe, expect, it } from 'bun:test'
import { parseScutilForTest } from './system-proxy'

describe('parseScutilForTest', () => {
  it('reads HTTPS proxy first', () => {
    const parsed = parseScutilForTest(`
HTTPEnable : 1
HTTPProxy : 10.0.0.1
HTTPPort : 8080
HTTPSEnable : 1
HTTPSProxy : proxy.corp
HTTPSPort : 8443
`)
    expect(parsed).toEqual({ host: 'proxy.corp', port: '8443' })
  })

  it('falls back to HTTP when HTTPS is off', () => {
    const parsed = parseScutilForTest(`
HTTPEnable : 1
HTTPProxy : 10.0.0.1
HTTPPort : 8080
HTTPSEnable : 0
`)
    expect(parsed).toEqual({ host: '10.0.0.1', port: '8080' })
  })

  it('returns empty when nothing is enabled', () => {
    expect(parseScutilForTest('HTTPEnable : 0\nHTTPSEnable : 0')).toEqual({})
  })
})
