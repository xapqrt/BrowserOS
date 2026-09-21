import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createBrowserOSAction } from '@/lib/chat-actions/types'
import {
  SIDEPANEL_AI_TRIGGERED_EVENT,
  SIDEPANEL_MODE_CHANGED_EVENT,
  SIDEPANEL_STOP_CLICKED_EVENT,
  SIDEPANEL_SUGGESTION_CLICKED_EVENT,
  SIDEPANEL_TAB_REMOVED_EVENT,
  SIDEPANEL_TAB_TOGGLED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { useChatSessionContext } from '@/modules/chat/chat-session-context'
import { readStoredConversationId } from '@/modules/chat/chat-session.hooks'
import { useServerConversations } from '@/modules/conversations/conversations.hooks'
import type { ChatMode } from '@/modules/chat/chat-types'
import { useJtbdPopup } from '@/modules/jtbd-popup/jtbd-popup.hooks'
import { buildChatErrorProps } from './Chat.helpers'
import { ChatEmptyState } from './ChatEmptyState'
import { ChatError } from './ChatError'
import { ChatFooter } from './ChatFooter'
import { ChatMessages } from './ChatMessages'
import { IncognitoNotice } from './IncognitoNotice'

/**
 * @public
 */
export const Chat = () => {
  const {
    mode,
    setMode,
    messages,
    sendMessage,
    status,
    stop,
    agentUrlError,
    chatError,
    canSend,
    selectedProvider,
    getActionForMessage,
    liked,
    onClickLike,
    disliked,
    onClickDislike,
    isRestoringConversation,
    isIncognito,
    restoreError,
    retryRestoreConversation,
    conversationId,
    retryLastTurn,
  } = useChatSessionContext()

  const {
    popupVisible,
    showDontShowAgain,
    recordMessageSent,
    triggerIfEligible,
    onTakeSurvey,
    onDismiss: onDismissJtbdPopup,
  } = useJtbdPopup()

  const { data: historyRows = [] } = useServerConversations()
  const knownHistoryIds = new Set(historyRows.map((row) => row.id))
  const lastGoodId = (() => {
    const stored = readStoredConversationId()
    if (!stored || stored === conversationId) return null
    if (knownHistoryIds.size > 0 && !knownHistoryIds.has(stored)) return null
    return stored
  })()
  const [input, setInput] = useState('')
  const [attachedTabs, setAttachedTabs] = useState<chrome.tabs.Tab[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Do not auto-attach the current tab. That left leftover tabs on the next
  // prompt and made it look like the composer was stuck to the last page.

  // Trigger JTBD popup when AI finishes responding
  const previousChatStatus = useRef(status)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only trigger on status change
  useEffect(() => {
    const aiWasProcessing =
      previousChatStatus.current === 'streaming' ||
      previousChatStatus.current === 'submitted'
    const aiJustFinished = aiWasProcessing && status === 'ready'

    if (aiJustFinished && messages.length > 0) {
      triggerIfEligible()
    }
    previousChatStatus.current = status
  }, [status])

  const handleModeChange = (newMode: ChatMode) => {
    track(SIDEPANEL_MODE_CHANGED_EVENT, { from: mode, to: newMode })
    setMode(newMode)
  }

  const handleStop = () => {
    track(SIDEPANEL_STOP_CLICKED_EVENT)
    void stop()
  }

  const toggleTabSelection = (tab: chrome.tabs.Tab) => {
    setAttachedTabs((prev) => {
      const isSelected = prev.some((t) => t.id === tab.id)
      track(SIDEPANEL_TAB_TOGGLED_EVENT, {
        action: isSelected ? 'removed' : 'added',
      })
      if (isSelected) {
        return prev.filter((t) => t.id !== tab.id)
      }
      return [...prev, tab]
    })
  }

  const removeTab = (tabId?: number) => {
    track(SIDEPANEL_TAB_REMOVED_EVENT)
    setAttachedTabs((prev) => prev.filter((t) => t.id !== tabId))
  }

  const executeMessage = (customMessageText?: string) => {
    const messageText = customMessageText ? customMessageText : input.trim()
    if (!messageText) return

    recordMessageSent()

    if (attachedTabs.length) {
      const action = createBrowserOSAction({
        mode,
        message: messageText,
        tabs: attachedTabs,
      })
      sendMessage({ text: messageText, action })
    } else {
      sendMessage({ text: messageText })
    }
    setInput('')
    setAttachedTabs([])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (messages.length === 0) {
      track(SIDEPANEL_AI_TRIGGERED_EVENT, {
        mode,
        tabs_count: attachedTabs.length,
      })
    }
    executeMessage()
  }

  const handleSuggestionClick = (suggestion: string) => {
    track(SIDEPANEL_SUGGESTION_CLICKED_EVENT, { mode })
    executeMessage(suggestion)
  }

  const chatErrorProps = buildChatErrorProps({
    chatError,
    selectedProvider,
    retryLastTurn,
  })

  return (
    <>
      <main className="mt-4 flex h-full flex-1 flex-col space-y-4 overflow-y-auto">
        {isRestoringConversation ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-xs">Opening this chat…</p>
          </div>
        ) : restoreError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-muted-foreground text-sm">{restoreError}</p>
            <button
              type="button"
              className="text-primary text-sm underline"
              onClick={() => retryRestoreConversation()}
            >
              Try again
            </button>
            {lastGoodId ? (
              <a
                href={`#/?conversationId=${lastGoodId}`}
                className="text-primary text-sm underline"
              >
                Open last saved chat
              </a>
            ) : null}
          </div>
        ) : messages.length === 0 ? (
          <ChatEmptyState
            mode={mode}
            mounted={mounted}
            onSuggestionClick={handleSuggestionClick}
            resumeConversationId={lastGoodId}
          />
        ) : (
          <ChatMessages
            messages={messages}
            status={status}
            hasError={!!chatError}
            getActionForMessage={getActionForMessage}
            liked={liked}
            onClickLike={onClickLike}
            disliked={disliked}
            onClickDislike={onClickDislike}
            showJtbdPopup={popupVisible}
            showDontShowAgain={showDontShowAgain}
            onTakeSurvey={onTakeSurvey}
            onDismissJtbdPopup={onDismissJtbdPopup}
          />
        )}
        {agentUrlError && (
          <ChatError
            error={agentUrlError}
            providerType={selectedProvider?.type}
          />
        )}
        {chatErrorProps && <ChatError {...chatErrorProps} />}
      </main>

      {isIncognito && <IncognitoNotice />}

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
    </>
  )
}
