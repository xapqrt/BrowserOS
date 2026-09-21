import type { ProtocolApi } from '@browseros/cdp-protocol/protocol-api'
import type { PageManager } from './pages'

const LOAD_TIMEOUT_MS = 8_000

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Polls readyState until the document is usable, then gives up.
 * SPAs and analytics keep `complete` from ever firing; interactive is enough.
 * After the cap we stop Chromium's spinner so the agent does not wait forever.
 */
async function waitForLoad(
  session: ProtocolApi,
  timeout = LOAD_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeout
  await delay(50)
  while (Date.now() < deadline) {
    try {
      const result = await session.Runtime.evaluate({
        expression: 'document.readyState',
        returnByValue: true,
      })
      const ready = result.result?.value
      if (ready === 'complete' || ready === 'interactive') return
    } catch {
      // Execution context torn down mid-navigation — expected; keep polling.
    }
    await delay(150)
  }
  await session.Page.stopLoading().catch(() => undefined)
}

/** Navigation for a single page: url / reload / back / forward, each awaiting load. */
export class Navigation {
  constructor(
    private readonly pages: PageManager,
    private readonly pageId: number,
  ) {}

  async goto(url: string): Promise<void> {
    const { session } = await this.pages.getSession(this.pageId)
    await session.Page.navigate({ url })
    await waitForLoad(session)
  }

  async reload(): Promise<void> {
    const { session } = await this.pages.getSession(this.pageId)
    await session.Page.reload()
    await waitForLoad(session)
  }

  async back(): Promise<void> {
    await this.history('back')
  }

  async forward(): Promise<void> {
    await this.history('forward')
  }

  private async history(direction: 'back' | 'forward'): Promise<void> {
    const { session } = await this.pages.getSession(this.pageId)
    await session.Runtime.evaluate({
      expression: `history.${direction}()`,
      awaitPromise: true,
    })
    await waitForLoad(session)
  }
}
