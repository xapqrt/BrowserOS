import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import { type FC, useState } from 'react'
import { Link } from 'react-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { conversationTitle } from '@/modules/conversations/history-list'
import type { HistoryConversation } from './types'

dayjs.extend(relativeTime)

export interface ConversationItemProps {
  conversation: HistoryConversation
  onDelete?: (id: string) => void
  isActive: boolean
  customTitle?: string
  pinned?: boolean
  onRename?: (id: string, title: string) => void
  onTogglePin?: (id: string) => void
}

function originLabel(origin?: string): string | null {
  if (!origin) return null
  if (origin === 'newtab') return 'New tab'
  if (origin === 'sidepanel') return 'Panel'
  return origin
}

function agentLabel(targetType?: string): string | null {
  if (!targetType || targetType === 'browseros') return null
  if (targetType === 'codex') return 'Codex'
  if (targetType === 'claude') return 'Claude'
  return targetType
}

export const ConversationItem: FC<ConversationItemProps> = ({
  conversation,
  onDelete,
  isActive,
  customTitle,
  pinned,
  onRename,
  onTogglePin,
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const label =
    customTitle?.trim() || conversationTitle(conversation.lastUserMessage)
  const relativeTimeAgo = dayjs(conversation.lastMessagedAt).fromNow()
  const where = originLabel(conversation.origin)
  const agent = agentLabel(conversation.targetType)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDeleteDialog(true)
  }

  const commitRename = () => {
    onRename?.(conversation.id, draft.trim())
    setEditing(false)
  }

  const handleRename = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDraft(label)
    setEditing(true)
  }

  const handlePin = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onTogglePin?.(conversation.id)
  }

  const handleConfirmDelete = () => {
    onDelete?.(conversation.id)
    setShowDeleteDialog(false)
  }

  return (
    <>
      <Link
        to={`/?conversationId=${conversation.id}`}
        className={`group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50 ${
          isActive ? 'bg-muted/70' : ''
        }`}
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          {editing ? (
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitRename}
              onClick={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitRename()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setEditing(false)
                }
              }}
              className="w-full rounded border border-border bg-background px-1 py-0.5 font-medium text-foreground text-sm"
            />
          ) : (
            <p className="truncate font-medium text-foreground text-sm">
              {pinned ? '📌 ' : ''}
              {label}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            {relativeTimeAgo}
            {where ? ` · ${where}` : ''}
            {agent ? ` · ${agent}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          {onTogglePin ? (
            <button
              type="button"
              onClick={handlePin}
              className="rounded-md p-2 text-muted-foreground hover:text-foreground"
              title={pinned ? 'Unpin' : 'Pin'}
            >
              {pinned ? (
                <PinOff className="h-3.5 w-3.5" />
              ) : (
                <Pin className="h-3.5 w-3.5" />
              )}
            </button>
          ) : null}
          {onRename ? (
            <button
              type="button"
              onClick={handleRename}
              className="rounded-md p-2 text-muted-foreground hover:text-foreground"
              title="Rename"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete conversation"
              title="Delete from this device and your account"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </Link>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat everywhere?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes it from this device and from your account copy if one
              exists. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
