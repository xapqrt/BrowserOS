/**
 * Honor the OS / env proxy for outbound LLM traffic (#2686).
 * macOS: `scutil --proxy`. Windows: `netsh winhttp show proxy`.
 * Env: HTTP(S)_PROXY / NO_PROXY. PAC: first PROXY host:port, fail-open.
 * Loopback (Ollama / LM Studio) stays direct.
 */

import { spawnSync } from 'node:child_process'

function alreadyConfigured(): boolean {
  return Boolean(
    process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy,
  )
}

function parseScutil(output: string): {
  host?: string
  port?: string
  pacUrl?: string
} {
  const map: Record<string, string> = {}
  for (const line of output.split('\n')) {
    const match = line.trim().match(/^(\w+)\s*:\s*(.+)$/)
    if (match) map[match[1]] = match[2].trim()
  }
  const httpsOn = map.HTTPSEnable === '1'
  const httpOn = map.HTTPEnable === '1'
  const pacOn = map.ProxyAutoConfigEnable === '1'
  if (httpsOn && map.HTTPSProxy) {
    return { host: map.HTTPSProxy, port: map.HTTPSPort }
  }
  if (httpOn && map.HTTPProxy) {
    return { host: map.HTTPProxy, port: map.HTTPPort }
  }
  if (pacOn && map.ProxyAutoConfigURLString) {
    return { pacUrl: map.ProxyAutoConfigURLString }
  }
  return {}
}

/** First `PROXY host:port` in a PAC script. DIRECT-only PAC is empty (fail-open). */
export function parsePacFindProxy(pacText: string): { host?: string; port?: string } {
  const match = pacText.match(/PROXY\s+([^\s;:]+):(\d+)/i)
  if (!match) return {}
  return { host: match[1], port: match[2] }
}

export function parseWinHttpProxy(output: string): { host?: string; port?: string } {
  const line = output.split('\n').find((l) => /proxy server/i.test(l))
  if (!line) return {}
  if (/direct access/i.test(output) && !/:\d+/.test(line)) return {}
  const match = line.match(/([^\s:]+):(\d+)/)
  if (!match) return {}
  return { host: match[1], port: match[2] }
}

function applyHostPort(host?: string, port?: string) {
  if (!host) return
  const url = `http://${host}${port ? `:${port}` : ''}`
  process.env.HTTP_PROXY ??= url
  process.env.HTTPS_PROXY ??= url
  process.env.http_proxy ??= url
  process.env.https_proxy ??= url
}

function fetchPacProxy(pacUrl: string): { host?: string; port?: string } {
  process.env.BROWSEROS_PAC_URL ??= pacUrl
  try {
    const result = spawnSync('curl', ['-fsS', '--max-time', '2', pacUrl], {
      encoding: 'utf8',
      timeout: 2500,
    })
    if (result.status !== 0 || !result.stdout) return {}
    return parsePacFindProxy(result.stdout)
  } catch {
    return {}
  }
}

/** Apply OS / PAC proxy into HTTP(S)_PROXY if unset. Fail-open. */
export function applySystemProxy(): void {
  if (alreadyConfigured()) {
    ensureNoProxyLoopback()
    return
  }
  try {
    if (process.platform === 'darwin') {
      const result = spawnSync('scutil', ['--proxy'], {
        encoding: 'utf8',
        timeout: 2000,
      })
      if (result.status === 0 && result.stdout) {
        const { host, port, pacUrl } = parseScutil(result.stdout)
        if (host) applyHostPort(host, port)
        else if (pacUrl) {
          const pac = fetchPacProxy(pacUrl)
          applyHostPort(pac.host, pac.port)
        }
      }
    } else if (process.platform === 'win32') {
      const result = spawnSync('netsh', ['winhttp', 'show', 'proxy'], {
        encoding: 'utf8',
        timeout: 2000,
      })
      if (result.status === 0 && result.stdout) {
        const parsed = parseWinHttpProxy(result.stdout)
        applyHostPort(parsed.host, parsed.port)
      }
    }
  } catch {
    // fail open to direct
  }
  ensureNoProxyLoopback()
}

function ensureNoProxyLoopback(): void {
  const extra = 'localhost,127.0.0.1,::1'
  const current = process.env.NO_PROXY || process.env.no_proxy || ''
  if (current.includes('127.0.0.1')) return
  const next = current ? `${current},${extra}` : extra
  process.env.NO_PROXY = next
  process.env.no_proxy = next
}

export function parseScutilForTest(output: string): {
  host?: string
  port?: string
  pacUrl?: string
} {
  return parseScutil(output)
}
