import { useQueryClient } from '@tanstack/react-query'
import type { FC } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { getQueryKeyFromDocument } from '@/lib/graphql/getQueryKeyFromDocument'
import { conversationIdFromWindowLocation } from '@/modules/chat/chat-session.hooks'
import { useChatSessionContext } from '@/modules/chat/chat-session-context'
import {
  useDeleteServerConversation,
  useServerConversations,
} from '@/modules/conversations/conversations.hooks'
import { conversationTitle } from '@/modules/conversations/history-list'
import {
  type HistoryMeta,
  historyMetaStorage,
} from '@/modules/conversations/history-meta'
import { useGraphqlMutation } from '@/modules/graphql/graphql-mutation.hooks'
import { ConversationList } from '../components/ConversationList'
import type { HistoryConversation } from '../components/types'
import { groupConversations } from '../components/utils'
import {
  DeleteConversationDocument,
  GetConversationsForHistoryDocument,
} from '../graphql/chatHistoryDocument'

export const LocalChatHistory: FC<{ search: string }> = ({ search }) => {
  const { data: serverConversations = [] } = useServerConversations()
  const deleteConversation = useDeleteServerConversation()
  const queryClient = useQueryClient()
  const deleteCloud = useGraphqlMutation(DeleteConversationDocument, {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          getQueryKeyFromDocument(GetConversationsForHistoryDocument),
        ],
      })
    },
  })
  const { conversationId: sessionConversationId } = useChatSessionContext()
  const activeConversationId =
    conversationIdFromWindowLocation() ?? sessionConversationId
  const [meta, setMeta] = useState<Record<string, HistoryMeta>>({})

  useEffect(() => {
    historyMetaStorage.getValue().then(setMeta)
    return historyMetaStorage.watch(setMeta)
  }, [])

  const conversations = useMemo<HistoryConversation[]>(() => {
    const query = search.trim().toLocaleLowerCase()
    return serverConversations
      .map((conversation) => ({
        id: conversation.id,
        lastMessagedAt: conversation.lastMessagedAt,
        lastUserMessage: conversation.lastUserMessage,
        origin: conversation.origin,
        targetType: conversation.targetType,
        agentId: conversation.agentId,
      }))
      .filter((conversation) => {
        if (!query) return true
        const title = (
          meta[conversation.id]?.title ||
          conversationTitle(conversation.lastUserMessage)
        ).toLocaleLowerCase()
        return (
          title.includes(query) ||
          conversation.lastUserMessage.toLocaleLowerCase().includes(query)
        )
      })
  }, [serverConversations, search, meta])

  const pinnedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [id, value] of Object.entries(meta)) {
      if (value.pinned) ids.add(id)
    }
    return ids
  }, [meta])

  const titles = useMemo(() => {
    const next: Record<string, string> = {}
    for (const [id, value] of Object.entries(meta)) {
      if (value.title) next[id] = value.title
    }
    return next
  }, [meta])

  const groupedConversations = useMemo(
    () => groupConversations(conversations, pinnedIds),
    [conversations, pinnedIds],
  )

  const persistMeta = (next: Record<string, HistoryMeta>) => {
    setMeta(next)
    void historyMetaStorage.setValue(next)
  }

  return (
    <ConversationList
      groupedConversations={groupedConversations}
      activeConversationId={activeConversationId}
      onDelete={(id) => {
        deleteConversation.mutate(id)
        deleteCloud.mutate({ rowId: id })
      }}
      emptyMessage="No chats on this device yet. Send a message, then they show up here."
      titles={titles}
      pinnedIds={pinnedIds}
      onRename={(id, title) => {
        persistMeta({
          ...meta,
          [id]: { ...meta[id], title: title || undefined },
        })
      }}
      onTogglePin={(id) => {
        persistMeta({
          ...meta,
          [id]: { ...meta[id], pinned: !meta[id]?.pinned },
        })
      }}
    />
  )
}
