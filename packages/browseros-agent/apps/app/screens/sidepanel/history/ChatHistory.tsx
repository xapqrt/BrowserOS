import type { FC } from 'react'
import { useMemo, useState } from 'react'
import { useSessionInfo } from '@/lib/auth/sessionStorage'
import { useChatSessionContext } from '@/modules/chat/chat-session-context'
import { useServerConversations } from '@/modules/conversations/conversations.hooks'
import { IncognitoNotice } from '@/screens/sidepanel/index/IncognitoNotice'
import { CloudChatHistory } from './cloud/CloudChatHistory'
import { LocalChatHistory } from './local/LocalChatHistory'

export const ChatHistory: FC = () => {
  const { sessionInfo } = useSessionInfo()
  const { isIncognito } = useChatSessionContext()
  const userId = sessionInfo.user?.id
  const [search, setSearch] = useState('')
  const { data: localConversations = [] } = useServerConversations()
  const localIds = useMemo(
    () => new Set(localConversations.map((conversation) => conversation.id)),
    [localConversations],
  )

  return (
    <main className="mt-4 flex h-full flex-1 flex-col overflow-y-auto">
      {isIncognito ? <IncognitoNotice /> : null}
      <div className="px-3 pb-1">
        <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          All chats
        </h2>
        <p className="text-muted-foreground text-xs">
          Panel and new-tab chats on this Mac. Pin and rename stay on this
          device.
        </p>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search chats"
          className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>
      <LocalChatHistory search={search} />
      {userId ? <CloudChatHistory userId={userId} localIds={localIds} /> : null}
    </main>
  )
}
