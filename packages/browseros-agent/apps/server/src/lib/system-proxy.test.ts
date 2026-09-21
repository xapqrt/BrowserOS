import { describe, expect, it } from 'bun:test'
import {
  parsePacFindProxy,
  parseScutilForTest,
  parseWinHttpProxy,
} from './system-proxy'

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

  it('surfaces a PAC URL when only auto-config is on', () => {
    expect(
      parseScutilForTest(
        'ProxyAutoConfigEnable : 1\nProxyAutoConfigURLString : http://wpad/proxy.pac',
      ),
    ).toEqual({ pacUrl: 'http://wpad/proxy.pac' })
  })
})

describe('parsePacFindProxy', () => {
  it('takes the first PROXY host:port', () => {
    expect(
      parsePacFindProxy(
        'function FindProxyForURL() { return "PROXY corp.example:3128; DIRECT"; }',
      ),
    ).toEqual({ host: 'corp.example', port: '3128' })
  })

  it('is empty for DIRECT-only PAC', () => {
    expect(parsePacFindProxy('return "DIRECT"')).toEqual({})
  })

  it('reads HTTPS and SOCKS PAC tokens', () => {
    expect(
      parsePacFindProxy('return "HTTPS proxy.corp:8443; DIRECT"'),
    ).toEqual({ host: 'proxy.corp', port: '8443' })
    expect(parsePacFindProxy('return "SOCKS5 10.0.0.8:1080"')).toEqual({
      host: '10.0.0.8',
      port: '1080',
    })
  })
})

describe('parseWinHttpProxy', () => {
  it('reads netsh proxy server', () => {
    expect(
      parseWinHttpProxy(
        'Current WinHTTP proxy settings:\n    Proxy Server(s) :  10.1.1.9:8080\n    Bypass List     :  <local>\n',
      ),
    ).toEqual({ host: '10.1.1.9', port: '8080' })
  })
})
