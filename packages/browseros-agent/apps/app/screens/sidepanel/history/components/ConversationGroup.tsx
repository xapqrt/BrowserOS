import type { FC } from 'react'
import { ConversationItem } from './ConversationItem'
import type { HistoryConversation } from './types'

export interface ConversationGroupProps {
  label: string
  conversations: HistoryConversation[]
  onDelete?: (id: string) => void
  activeConversationId: string
  titles?: Record<string, string>
  pinnedIds?: ReadonlySet<string>
  onRename?: (id: string, title: string) => void
  onTogglePin?: (id: string) => void
}

export const ConversationGroup: FC<ConversationGroupProps> = ({
  label,
  conversations,
  onDelete,
  activeConversationId,
  titles,
  pinnedIds,
  onRename,
  onTogglePin,
}) => {
  if (conversations.length === 0) return null

  return (
    <div className="mb-4">
      <h3 className="mb-2 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </h3>
      <div className="space-y-1">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            onDelete={onDelete}
            isActive={conversation.id === activeConversationId}
            customTitle={titles?.[conversation.id]}
            pinned={pinnedIds?.has(conversation.id)}
            onRename={onRename}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
    </div>
  )
}
