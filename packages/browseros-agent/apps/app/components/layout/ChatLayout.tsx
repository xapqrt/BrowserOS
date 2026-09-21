import type { FC } from 'react'
import { useLocation } from 'react-router'
import {
  ChatSessionProvider,
  useChatSessionContext,
} from '@/modules/chat/chat-session-context'
import { readStoredConversationId } from '@/modules/chat/chat-session.hooks'
import { useServerConversations } from '@/modules/conversations/conversations.hooks'
import { conversationTitle } from '@/modules/conversations/history-list'
import { ChatHistory } from '@/screens/sidepanel/history/ChatHistory'
import { Chat } from '@/screens/sidepanel/index/Chat'
import { ChatHeader } from '@/screens/sidepanel/index/ChatHeader'

const ChatLayoutContent: FC = () => {
  const {
    providers,
    selectedProvider,
    handleSelectProvider,
    resetConversation,
    messages,
    conversationId,
  } = useChatSessionContext()
  const { data: historyRows = [] } = useServerConversations()

  const location = useLocation()
  const isHistoryPage = location.pathname === '/history'
  const lastUserText = [...messages]
    .reverse()
    .find((m) => m.role === 'user')
    ?.parts.filter((p) => p.type === 'text')
    .map((p) => ('text' in p ? p.text : ''))
    .join(' ')
  const threadTitle = lastUserText ? conversationTitle(lastUserText) : undefined
  const storedId = readStoredConversationId()
  const knownIds = new Set(historyRows.map((row) => row.id))
  const resumeConversationId =
    storedId &&
    storedId !== conversationId &&
    (knownIds.size === 0 || knownIds.has(storedId))
      ? storedId
      : null

  // History is an overlay so the live chat (and its stream) stay mounted.
  return (
    <div className="relative mx-auto flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {selectedProvider ? (
        <ChatHeader
          selectedProvider={selectedProvider}
          onSelectProvider={handleSelectProvider}
          providers={providers}
          onNewConversation={resetConversation}
          hasMessages={messages.length > 0}
          threadTitle={threadTitle}
          resumeConversationId={resumeConversationId}
        />
      ) : (
        <div className="flex h-12 shrink-0 items-center px-3 text-muted-foreground text-xs">
          {isHistoryPage ? 'History' : 'Starting…'}
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Chat />
        {isHistoryPage ? (
          <div className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-background">
            <ChatHistory />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export const ChatLayout: FC = () => {
  return (
    <ChatSessionProvider>
      <ChatLayoutContent />
    </ChatSessionProvider>
  )
}
