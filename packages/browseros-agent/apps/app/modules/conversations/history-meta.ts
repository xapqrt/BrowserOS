import { storage } from '@wxt-dev/storage'

export interface HistoryMeta {
  title?: string
  pinned?: boolean
}

export const historyMetaStorage = storage.defineItem<
  Record<string, HistoryMeta>
>('local:historyMeta', { fallback: {} })

export function displayHistoryTitle(
  lastUserMessage: string,
  meta: HistoryMeta | undefined,
  fallbackTitle: (text: string) => string,
): string {
  const custom = meta?.title?.trim()
  if (custom) return custom
  return fallbackTitle(lastUserMessage)
}
