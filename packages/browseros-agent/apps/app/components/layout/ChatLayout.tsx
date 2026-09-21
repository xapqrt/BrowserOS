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
    isLoading,
  } = useChatSessionContext()

  const location = useLocation()
  const isHistoryPage = location.pathname === '/history'
  // History must stay clickable even while providers/agent URL load. A full-screen
  // spinner here was covering the list so taps looked like they "did nothing".
  if (!isHistoryPage && (isLoading || !selectedProvider)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    )
  }

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
      ) : null}
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
