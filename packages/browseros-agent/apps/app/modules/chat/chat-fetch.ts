import { TIMEOUTS } from '@browseros/shared/constants/timeouts'

/** Fetch for /chat. CHAT_FIRST_BYTE 0 means never abort a live stream. */
export async function chatFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const ms = TIMEOUTS.CHAT_FIRST_BYTE
  if (!ms) return fetch(input, init)
  const timeout = AbortSignal.timeout(ms)
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout
  return fetch(input, { ...init, signal })
}
