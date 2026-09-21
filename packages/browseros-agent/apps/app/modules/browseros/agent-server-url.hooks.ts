import { useEffect, useState } from 'react'
import { resolveAgentServerUrlWithRetry } from './agent-server-url.helpers'

export type UseAgentServerUrlResult =
  | { baseUrl: string; isLoading: false; error: null }
  | { baseUrl?: never; isLoading: true; error: null }
  | { baseUrl?: never; isLoading: false; error: Error }

/** Resolves the local BrowserOS server URL used by React surfaces. */
export function useAgentServerUrl(): UseAgentServerUrlResult {
  const [state, setState] = useState<UseAgentServerUrlResult>({
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    let healthy = false

    async function loadUrl() {
      if (healthy) return
      try {
        const url = await resolveAgentServerUrlWithRetry()
        if (!cancelled) {
          healthy = true
          setState({ baseUrl: url, isLoading: false, error: null })
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            isLoading: false,
            error: e instanceof Error ? e : new Error(String(e)),
          })
        }
      }
    }

    void loadUrl()
    const id = window.setInterval(() => {
      void loadUrl()
    }, 4_000)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return state
}
