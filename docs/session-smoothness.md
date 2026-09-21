# BrowserOS session smoothness (this fork)

This document is the map of the daily-use work on branch `arena/01a0c3aa-browseros`. It is for **BrowserOS** (the human browser: side panel + new tab + Bun agent), **macOS**, not BrowserOS neo.

Upstream felt slacky. The goal: **never sit waiting**. History, send, stop, restore, and the agent keep moving. If something fails, it retries a few times and then continues with what it has.

**Do not merge** this branch unless you mean to. Commits stay on `arena/01a0c3aa-browseros`.

---

## What you should feel

| You do | What happens |
|--------|----------------|
| Click a chat in History | That thread opens. No flash of another conversation. |
| Search / pin / rename | Works on this Mac. Rename is inline (Enter / Esc). |
| New Chat | Blank composer. The old thread stays in History. |
| Resume | Opens the last **saved** id, not a dead UUID. |
| Type and Send | Send is never grey because the local server is still booting. The message queues. |
| Stop | Stream detaches, server `/stop`, glow off, selected-text chip gone. |
| Agent on a SPA | Navigate returns in **≤ 8s**. Spinner is stopped. The model is told not to wait for `complete`. |
| Agent clicks | Your current tab is **not** stolen. |
| Site never finishes loading | Agent snapshots and acts anyway. |
| Local server not up yet | URL discovery retries every 4s until healthy. |
| 0 BrowserOS credits | Badge says **Out of credits** (red). |
| Slow history open | After 8s: Try again / Open last saved chat. A late success still shows the transcript. |

---

## Timeouts and caps (source of truth)

| Constant | Value | Where |
|----------|-------|--------|
| Page load wait | **8s**, `interactive` or `complete`, then `Page.stopLoading` | `crates/browseros-core/src/timeouts.rs` `WAIT_FOR_LOAD_TIMEOUT`, `packages/browser-core/src/core/navigation.ts` |
| Shared `PAGE_LOAD_WAIT` | **8_000** | `packages/shared/src/constants/timeouts.ts` |
| Blind `wait` (time) | default 2s, **max 2s** | `crates/browseros-mcp/src/tools/wait.rs`, `packages/browser-mcp/src/tools/wait.ts` |
| `wait` text/selector | default 2s, **max 8s** | same |
| Chat first byte | **0** (never abort a live stream) | `TIMEOUTS.CHAT_FIRST_BYTE`, `apps/app/modules/chat/chat-fetch.ts` |
| CDP request | **120s** | `TIMEOUTS.CDP_REQUEST_TIMEOUT` |
| Restore open | **8s** then error UI, restore can still succeed | `chat-session.hooks.ts` |
| Panel run-state fetch | **10s** | `AbortSignal.timeout(10_000)` in attach |
| Agent URL retry | 3 attempts × 500ms, then every **4s** until healthy | `agent-server-url.helpers.ts`, `agent-server-url.hooks.ts` |
| Panel hydrate retries | **6** then stop | `panel-conversation-attachment.ts` |
| Agent turns | **250** | `AGENT_LIMITS.MAX_TURNS` |
| `run` / `evaluate` | **30s** then job + `poll` (at most twice) | `run.rs`, `evaluate.rs`, `poll.rs`, `jobs.rs` |
| Consecutive wait loops | Prompt: do not loop; one wait per step | `apps/server/src/agent/prompt.ts` |

---

## History (side panel + new tab)

**Problem.** History clicks restored the wrong chat, flashed GraphQL, New Chat felt like delete, panel and new-tab lists were split, search/pin/rename missing.

**What we did.**

- History is an **overlay** on the live chat (`ChatLayout`). The stream stays mounted.
- Restore prefers **local SQLite**. GraphQL is **disabled** for that path (`enabled: false`).
- URL `conversationId` (HashRouter: hash query) is the source of truth. Panel SSE cannot clobber a history click.
- **New Chat** mints a new id and does **not** delete the previous server row. Last id stays in `sessionStorage` for Resume.
- Resume only if that id is still in the local list (or the list has not loaded yet).
- One list: panel + new-tab, with origin labels (`Panel` / `New tab`). Codex/Claude threads tagged.
- Search filters title + last user message.
- Pin / rename stored in `local:historyMeta` (`history-meta.ts`). Names stay on this device.
- Inline rename; Link does not navigate while the input is focused.
- Cloud delete only if signed in. Cloud shelf stays a separate “Saved to your account” section.
- Empty copy: history is **shared**, not “panel vs new tab”.

**Key files**

- `apps/app/components/layout/ChatLayout.tsx`
- `apps/app/modules/chat/chat-session.hooks.ts`
- `apps/app/modules/chat/chat-session-restore.ts`
- `apps/app/screens/sidepanel/history/*`
- `apps/app/modules/conversations/history-meta.ts`
- `apps/app/screens/newtab/index/NewTabChat.tsx`

---

## Composer, stop, glow, tools UI

**Problem.** Send blocked until providers + agent URL. Stop did not kill glow. Bounce dots + tool batch looked like two agents. Footer stole focus on every window focus. Agent mode chip looked “off”. Selected text stuck after Stop.

**What we did.**

- `canSend` is always true. If the server URL is missing, `sendMessage` **queues** until `agentServerUrl` is set.
- Agent URL: retry loop every 4s until one success, then stop.
- Chat fetch does not abort first-byte (`CHAT_FIRST_BYTE: 0`).
- Stop: detach view, `POST /chat/:id/stop`, clear selected-text for the tab that was sent, `sendMessage` glow `{ isActive: false }` to tabs in the window.
- Bounce dots hidden when the last message already has a tool batch.
- Footer focuses the composer **once on mount**, not on every window focus.
- Agent/Chat chip always uses the orange selected look.
- Stop button copy: “Stop this turn”.
- New tab: do not `return null` while providers load; show “Starting…” + composer.
- Credits: `0` → **Out of credits**.

**Key files**

- `apps/app/modules/chat/chat-session.hooks.ts`
- `apps/app/modules/chat/chat-fetch.ts`
- `apps/app/modules/browseros/agent-server-url.hooks.ts`
- `apps/app/screens/sidepanel/index/Chat.tsx`
- `apps/app/screens/sidepanel/index/ChatFooter.tsx`
- `apps/app/screens/sidepanel/index/ChatInput.tsx`
- `apps/app/screens/sidepanel/index/ChatMessages.tsx`
- `apps/app/screens/sidepanel/index/ChatModeToggle.tsx`
- `apps/app/screens/sidepanel/index/ChatHeader.tsx`
- `apps/app/components/credits/CreditBadge.tsx`
- `apps/app/entrypoints/glow.content/index.ts`

---

## Agent must not wait forever

**Problem.** SPAs never reach `document.complete`. TS `waitForLoad` waited 30s for complete only. Models saw `isLoading` and looped `wait`. Act/navigate **activated** the tab and stole the window. `poll` said “keep polling until done”.

**What we did.**

- Navigate: poll `readyState` until **interactive or complete**, **8s**, then **`Page.stopLoading`**. Rust and TS.
- MCP `isLoading` in tab JSON is true only if `is_loading && load_progress < 0.5`.
- Settle treats progress ≥ 0.9 as not loading.
- Do **not** `pages.activate` on every act/navigate/wait.
- Prompt: never wait for the spinner; after navigate, snapshot/act; at most one wait; truncated reads → `filesystem_read`.
- `wait` time pause capped at 2s; text/selector 8s.
- `poll`: at most twice, then continue other work.
- Parked `run`/`evaluate` after 30s; `poll` + `jobs.rs`. Cancel supported.
- Mac: `caffeinate -i` while a tool runs (`idle_sleep.rs`) so idle sleep does not kill a long turn.

**Key files**

- `packages/browser-core/src/core/navigation.ts`
- `crates/browseros-core/src/navigation.rs`
- `crates/browseros-core/src/timeouts.rs`
- `crates/browseros-core/src/settle.rs`
- `crates/browseros-mcp/src/framework.rs` (`page_json`, no activate)
- `crates/browseros-mcp/src/tools/wait.rs`, `navigate.rs`, `poll.rs`, `run.rs`
- `crates/browseros-mcp/src/jobs.rs`, `idle_sleep.rs`
- `apps/server/src/agent/prompt.ts`
- `packages/browser-mcp/src/mcp-prompt.ts`
- `apps/server/src/api/services/mcp/mcp-prompt.ts`

---

## MCP / network leftovers that hit daily use

Shipped so the agent is usable on a Mac, not as a full OS:

| Item | Change |
|------|--------|
| Screenshots to the model | Compaction / OpenRouter path keeps image parts for providers that `supportsImages`. |
| MCP bind | Loopback, not LAN. |
| Electron `Sec-Fetch-Site: none` | Treated as same-origin so local UI is not CSRF-blocked. |
| PAC | First `PROXY host:port` regex (not a JS PAC engine). |
| Session handle | MCP `_meta` `com.browseros/session`. |
| System HTTPS proxy | `system-proxy.ts` for the Bun server. |
| WebAuthn entitlements | `app-entitlements-browseros.plist` — **needs a Chromium rebuild**. |
| Scheduled jobs | Hourly catch-up (`scheduledJobCatchUp.ts`). |

---

## Restore races (bug hunts)

1. **Timeout vs late SQLite.** Timeout used to mark the id restored *and* set an error. Late success left the error on screen. Now timeout only sets the error; `onRestore` clears it; UI is spinner **or** error (if no messages) **or** transcript.
2. **New tab** had the old spinner-only restore. Matched the panel.
3. **`userId` undefined** in local history delete — would not compile. Wired `useSessionInfo`.
4. Infinite panel hydrate retries — capped at 6.

---

## Git (this branch)

Representative commits (oldest first among the smoothness work):

- History overlay, send, mode copy, tools
- Unified history, search, pin/rename, resume
- Composer stop/scroll, model/credits
- MCP 1–10 (screenshots, bind, CSRF, PAC, session)
- 8s load + stopLoading + prompt
- No tab steal, 2s wait, queue send, glow/stop
- Restore race, inline rename, poll twice
- New-tab restore, Out of credits
- Send always on, 6 hydrate retries, Agent chip

HEAD moves; `git log affaa90..HEAD` is the full list.

---

## What is **not** done (on purpose)

- **Do not merge** to `main` unless asked.
- Linux / Windows sandbox / uBlock / Sogou — out of scope for this Mac session.
- Full PAC JavaScript engine.
- Cloud pin/rename sync.
- New-tab **sidebar** pin/rename (use the side-panel History overlay).
- WebAuthn / Touch ID until you **rebuild Chromium** with the entitlements patch.
- Chromium “Crashed” session restore (`exit_type`) — browser process, not the agent.
- OpenRouter model catalog fetch.

---

## How to verify on a Mac

1. Reload the side panel / new tab on this build.
2. Send a message → it goes (or queues, then goes).
3. Open History → click a row → that chat, no flash.
4. New Chat → empty; History still has the old one; Resume works.
5. Pin and rename a row; reload History.
6. Stop mid-turn → glow gone, composer ready.
7. Agent on a SPA (e.g. a dashboard) → does not sit on the spinner.
8. Your foreground tab stays yours while the agent works in the background.

If something still spins, note the exact click and which surface (panel vs new tab).
