import type { FC } from 'react'
import { Outlet, useLocation } from 'react-router'
import {
  ChatSessionProvider,
  useChatSessionContext,
} from '@/modules/chat/chat-session-context'
import { ChatHeader } from '@/screens/sidepanel/index/ChatHeader'

const ChatLayoutContent: FC = () => {
  const {
    providers,
    selectedProvider,
    handleSelectProvider,
    resetConversation,
    messages,
  } = useChatSessionContext()

  const location = useLocation()
  const isHistoryPage = location.pathname === '/history'

  // Never cover the panel with a full-screen spinner. That made history
  // clicks look dead: the list navigated to `/` and a loader ate the UI.
  return (
    <div className="mx-auto flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {selectedProvider ? (
        <ChatHeader
          selectedProvider={selectedProvider}
          onSelectProvider={handleSelectProvider}
          providers={providers}
          onNewConversation={resetConversation}
          hasMessages={messages.length > 0}
        />
      ) : (
        <div className="flex h-12 shrink-0 items-center px-3 text-muted-foreground text-xs">
          {isHistoryPage ? 'History' : 'Starting…'}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
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
