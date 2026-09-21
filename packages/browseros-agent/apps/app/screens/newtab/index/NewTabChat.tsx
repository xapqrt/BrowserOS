import { Loader2 } from 'lucide-react'
import { type FC, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import {
  createAITabAction,
  createBrowserOSAction,
} from '@/lib/chat-actions/types'
import {
  NEWTAB_AI_TRIGGERED_EVENT,
  NEWTAB_CHAT_MODE_CHANGED_EVENT,
  NEWTAB_CHAT_RESET_EVENT,
  NEWTAB_CHAT_STOPPED_EVENT,
  NEWTAB_CHAT_SUGGESTION_CLICKED_EVENT,
  NEWTAB_TAB_REMOVED_EVENT,
  NEWTAB_TAB_TOGGLED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { consumePendingHomeMessage } from '@/modules/chat/pending-home-message'
import { useChatActions } from '@/modules/chat-actions/chat-actions.hooks'
import { useActiveConversation } from '@/modules/conversations/active-conversation-context'
import { readStoredConversationId } from '@/modules/chat/chat-session.hooks'
import { conversationTitle } from '@/modules/conversations/history-list'
import { useServerConversations } from '@/modules/conversations/conversations.hooks'
import { ChatEmptyState } from '@/screens/sidepanel/index/ChatEmptyState'
import { ChatError } from '@/screens/sidepanel/index/ChatError'
import { ChatFooter } from '@/screens/sidepanel/index/ChatFooter'
import { ChatHeader } from '@/screens/sidepanel/index/ChatHeader'
import { ChatMessages } from '@/screens/sidepanel/index/ChatMessages'

export const NewTabChat: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const hasSentInitialRef = useRef(false)
  const { setId: setActiveConversationId } = useActiveConversation()

  const {
    mode,
    setMode,
    messages,
    sendMessage,
    status,
    agentUrlError,
    chatError,
    canSend,
    getActionForMessage,
    liked,
    onClickLike,
    disliked,
    onClickDislike,
    isRestoringConversation,
    restoreError,
    retryRestoreConversation,
    conversationId,
    providers,
    selectedProvider,
    handleSelectProvider,
    resetConversation,
    input,
    setInput,
    attachedTabs,
    mounted,
    handleModeChange,
    handleStop,
    toggleTabSelection,
    removeTab,
    handleSubmit,
    handleSuggestionClick,
    retryLastTurn,
  } = useChatActions({
    events: {
      modeChanged: NEWTAB_CHAT_MODE_CHANGED_EVENT,
      stopClicked: NEWTAB_CHAT_STOPPED_EVENT,
      suggestionClicked: NEWTAB_CHAT_SUGGESTION_CLICKED_EVENT,
      tabToggled: NEWTAB_TAB_TOGGLED_EVENT,
      tabRemoved: NEWTAB_TAB_REMOVED_EVENT,
      aiTriggered: NEWTAB_AI_TRIGGERED_EVENT,
    },
  })

  useEffect(() => {
    setActiveConversationId(isRestoringConversation ? null : conversationId)
    return () => setActiveConversationId(null)
  }, [conversationId, isRestoringConversation, setActiveConversationId])

  // Send the initial message from URL query params (from /home search bar).
  // Guarded by ref to prevent double-fire in React Strict Mode.
  // biome-ignore lint/correctness/useExhaustiveDependencies: must only run once on mount
  useEffect(() => {
    if (hasSentInitialRef.current) return
    if (searchParams.has('conversationId')) return
    const pending = consumePendingHomeMessage(searchParams.get('handoff'))
    const query = pending?.text ?? searchParams.get('q') ?? ''
    const chatMode = searchParams.get('mode')
    const tabIdsParam = searchParams.get('tabs')
    if (!query && !pending?.files.length) return

    hasSentInitialRef.current = true
    if (chatMode === 'chat' || chatMode === 'agent') {
      setMode(chatMode)
    }
    setSearchParams({}, { replace: true })

    const actionType = searchParams.get('actionType')
    const tabName = searchParams.get('tabName')
    const tabDescription = searchParams.get('tabDescription')

    if (tabIdsParam) {
      const tabIds = tabIdsParam.split(',').map(Number).filter(Boolean)
      chrome.tabs.query({}).then((allTabs) => {
        const matchedTabs = allTabs.filter(
          (t) => t.id !== undefined && tabIds.includes(t.id),
        )
        if (matchedTabs.length > 0) {
          const action =
            actionType === 'ai-tab' && tabName
              ? createAITabAction({
                  name: tabName,
                  description: tabDescription ?? '',
                  tabs: matchedTabs,
                })
              : createBrowserOSAction({
                  mode: (chatMode as 'chat' | 'agent') ?? 'agent',
                  message: query,
                  tabs: matchedTabs,
                })
          sendMessage({ text: query, action, files: pending?.files })
        } else {
          sendMessage({ text: query, files: pending?.files })
        }
      })
    } else {
      sendMessage({ text: query, files: pending?.files })
    }
  }, [])

  const handleNewConversation = () => {
    track(NEWTAB_CHAT_RESET_EVENT, { message_count: messages.length })
    resetConversation()
  }

  const { data: historyRows = [] } = useServerConversations()
  const storedId = readStoredConversationId()
  const knownIds = new Set(historyRows.map((row) => row.id))
  const lastGoodId =
    storedId &&
    storedId !== conversationId &&
    (knownIds.size === 0 || knownIds.has(storedId))
      ? storedId
      : null

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {selectedProvider ? (
        <ChatHeader
          selectedProvider={selectedProvider}
          providers={providers}
          onSelectProvider={handleSelectProvider}
          onNewConversation={handleNewConversation}
          hasMessages={messages.length > 0}
          hideHistory
          resumeConversationId={lastGoodId}
          className="shrink-0 px-4 sm:px-8"
        />
      ) : (
        <div className="flex h-12 shrink-0 items-center px-4 text-muted-foreground text-xs sm:px-8">
          Starting…
        </div>
      )}

      {/* Keep transcript and composer widths in sync; only the header spans the page. */}
      <main className="styled-scrollbar [&_[data-streamdown='code-block']]:!max-w-full [&_[data-streamdown='code-block']]:!w-auto [&_[data-streamdown='table-wrapper']]:!max-w-full [&_[data-streamdown='table-wrapper']]:!w-auto mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col space-y-4 overflow-y-auto overflow-x-hidden px-4 pt-4 sm:w-[calc(100%-4rem)] [&_[data-streamdown='code-block']]:overflow-x-auto [&_[data-streamdown='table-wrapper']]:overflow-x-auto">
        {isRestoringConversation && !restoreError ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : restoreError && messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-muted-foreground text-sm">{restoreError}</p>
            <button
              type="button"
              className="text-primary text-sm underline"
              onClick={() => retryRestoreConversation()}
            >
              Try again
            </button>
            <button
              type="button"
              className="text-primary text-sm underline"
              onClick={handleNewConversation}
            >
              New conversation
            </button>
          </div>
        ) : messages.length === 0 ? (
          <ChatEmptyState
            mode={mode}
            mounted={mounted}
            onSuggestionClick={handleSuggestionClick}
          />
        ) : (
          <>
            {searchParams.has('conversationId') && messages.length > 0 && (
              <h1 className="mb-2 line-clamp-2 font-semibold text-lg">
                {conversationTitle(
                  messages
                    .findLast((message) => message.role === 'user')
                    ?.parts.filter((part) => part.type === 'text')
                    .map((part) => part.text)
                    .join(' ') ?? '',
                )}
              </h1>
            )}
            <ChatMessages
              messages={messages}
              status={status}
              hasError={!!chatError}
              getActionForMessage={getActionForMessage}
              liked={liked}
              onClickLike={onClickLike}
              disliked={disliked}
              onClickDislike={onClickDislike}
              showJtbdPopup={false}
              showDontShowAgain={false}
              onTakeSurvey={() => {}}
              onDismissJtbdPopup={() => {}}
            />
          </>
        )}
        {agentUrlError && (
          <ChatError
            error={agentUrlError}
            providerType={selectedProvider?.type}
          />
        )}
        {chatError && (
          <ChatError
            error={chatError}
            onRetry={() => {
              void retryLastTurn()
            }}
            providerType={selectedProvider?.type}
          />
        )}
      </main>

      <div className="mx-auto w-full max-w-5xl flex-shrink-0 px-4 pb-2 sm:w-[calc(100%-4rem)]">
        <ChatFooter
          mode={mode}
          onModeChange={handleModeChange}
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          status={status}
          onStop={handleStop}
          sendDisabled={!canSend}
          attachedTabs={attachedTabs}
          onToggleTab={toggleTabSelection}
          onRemoveTab={removeTab}
        />
      </div>
    </div>
  )
}
