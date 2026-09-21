import type { ServerConversationSummary } from './conversations.hooks'

export const HISTORY_PAGE_SIZE = 6

const FILLER =
  /^(ok|okay|yes|yeah|yep|sure|thanks|thank you|thx|ty|k|kk|hmm|lol|cool|got it|please|continue|go on|done|wait)[.!?]*$/i

/** History row label: skip one-word acks so the list is not all "ok". */
export function conversationTitle(lastUserMessage: string): string {
  const trimmed = lastUserMessage.trim().replace(/\s+/g, ' ')
  if (!trimmed) return 'Untitled conversation'
  if (trimmed.length < 4 || FILLER.test(trimmed)) return 'Continued chat'
  const line = trimmed.split('\n')[0] ?? trimmed
  const sentence = line.split(/(?<=[.!?])\s/)[0] ?? line
  const base = sentence.length >= 8 ? sentence : line
  return base.length > 72 ? `${base.slice(0, 69)}…` : base
}

/** Group by local calendar days, not elapsed hours (which breaks at midnight/DST). */
export function historyDateGroup(timestamp: number, now: Date): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (timestamp >= today.getTime()) return 'Today'
  if (timestamp >= yesterday.getTime()) return 'Yesterday'
  return 'Earlier'
}

export function historyTimestamp(timestamp: number, now: Date): string {
  if (historyDateGroup(timestamp, now) === 'Today') {
    const minutes = Math.max(
      0,
      Math.floor((now.getTime() - timestamp) / 60_000),
    )
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
    const hours = Math.floor(minutes / 60)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  return new Date(timestamp).toLocaleString(
    undefined,
    historyDateGroup(timestamp, now) === 'Yesterday'
      ? { hour: 'numeric', minute: '2-digit' }
      : {
          month: 'short',
          day: 'numeric',
          ...(new Date(timestamp).getFullYear() !== now.getFullYear()
            ? { year: 'numeric' as const }
            : {}),
        },
  )
}

/** Search all locally stored summaries before limiting the visible rows. */
export function historyList(
  conversations: ServerConversationSummary[],
  search: string,
  limit: number,
  now: Date,
) {
  const query = search.trim().toLocaleLowerCase()
  const matching = conversations
    .filter((item) =>
      conversationTitle(item.lastUserMessage)
        .toLocaleLowerCase()
        .includes(query),
    )
    .sort(
      (a, b) => b.lastMessagedAt - a.lastMessagedAt || a.id.localeCompare(b.id),
    )
  const groups: {
    label: string
    conversations: ServerConversationSummary[]
  }[] = []
  for (const conversation of matching.slice(0, limit)) {
    const label = historyDateGroup(conversation.lastMessagedAt, now)
    let group = groups.at(-1)
    if (group?.label !== label) {
      group = { label, conversations: [] }
      groups.push(group)
    }
    group.conversations.push(conversation)
  }
  return { groups, hasMore: matching.length > limit, total: matching.length }
}
