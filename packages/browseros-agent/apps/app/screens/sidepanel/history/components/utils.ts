import type { UIMessage } from 'ai'
import dayjs from 'dayjs'
import type {
  GroupedConversations,
  HistoryConversation,
  TimeGroup,
} from './types'

export const TIME_GROUP_LABELS: Record<TimeGroup, string> = {
  pinned: 'Pinned',
  today: 'Today',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  older: 'Older',
}

const getTimeGroup = (timestamp: number): Exclude<TimeGroup, 'pinned'> => {
  const date = dayjs(timestamp)
  const now = dayjs()

  if (date.isSame(now, 'day')) return 'today'
  if (date.isSame(now, 'week')) return 'thisWeek'
  if (date.isSame(now, 'month')) return 'thisMonth'
  return 'older'
}

export const extractLastUserMessage = (messages: UIMessage[]): string => {
  const userMessages = messages.filter((m) => m.role === 'user')
  const lastUserMessage = userMessages[userMessages.length - 1]

  if (!lastUserMessage) return 'New conversation'

  const textParts = lastUserMessage.parts.filter((p) => p.type === 'text')
  const text = textParts.map((p) => (p as { text: string }).text).join(' ')

  return text || 'New conversation'
}

export const groupConversations = (
  conversations: HistoryConversation[],
  pinnedIds?: ReadonlySet<string>,
): GroupedConversations => {
  const groups: GroupedConversations = {
    pinned: [],
    today: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
  }

  for (const conversation of conversations) {
    if (pinnedIds?.has(conversation.id)) {
      groups.pinned.push(conversation)
      continue
    }
    const group = getTimeGroup(conversation.lastMessagedAt)
    groups[group].push(conversation)
  }

  return groups
}
