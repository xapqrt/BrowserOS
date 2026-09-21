/**
 * Honor the OS / env proxy for outbound LLM traffic (#2686).
 * macOS: `scutil --proxy`. Env: HTTP(S)_PROXY / NO_PROXY.
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

function parseScutil(output: string): { host?: string; port?: string } {
  const map: Record<string, string> = {}
  for (const line of output.split('\n')) {
    const match = line.trim().match(/^(\w+)\s*:\s*(.+)$/)
    if (match) map[match[1]] = match[2].trim()
  }
  const httpsOn = map.HTTPSEnable === '1'
  const httpOn = map.HTTPEnable === '1'
  if (httpsOn && map.HTTPSProxy) {
    return { host: map.HTTPSProxy, port: map.HTTPSPort }
  }
  if (httpOn && map.HTTPProxy) {
    return { host: map.HTTPProxy, port: map.HTTPPort }
  }
  return {}
}

/** Apply macOS system proxy into HTTP(S)_PROXY if unset. Fail-open. */
export function applySystemProxy(): void {
  if (alreadyConfigured()) {
    ensureNoProxyLoopback()
    return
  }
  if (process.platform !== 'darwin') {
    ensureNoProxyLoopback()
    return
  }
  try {
    const result = spawnSync('scutil', ['--proxy'], {
      encoding: 'utf8',
      timeout: 2000,
    })
    if (result.status !== 0 || !result.stdout) {
      ensureNoProxyLoopback()
      return
    }
    const { host, port } = parseScutil(result.stdout)
    if (host) {
      const url = `http://${host}${port ? `:${port}` : ''}`
      process.env.HTTP_PROXY ??= url
      process.env.HTTPS_PROXY ??= url
      process.env.http_proxy ??= url
      process.env.https_proxy ??= url
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

export function parseScutilForTest(output: string): { host?: string; port?: string } {
  return parseScutil(output)
}
