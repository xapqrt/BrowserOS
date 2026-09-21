export interface HistoryConversation {
  id: string
  lastMessagedAt: number
  lastUserMessage: string
  origin?: string
  targetType?: string
  agentId?: string
}

export type TimeGroup = 'today' | 'thisWeek' | 'thisMonth' | 'older' | 'pinned'

export interface GroupedConversations {
  pinned: HistoryConversation[]
  today: HistoryConversation[]
  thisWeek: HistoryConversation[]
  thisMonth: HistoryConversation[]
  older: HistoryConversation[]
}
