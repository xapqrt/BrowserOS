import type { FC } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { ChatLayout } from '@/components/layout/ChatLayout'

export const App: FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={<ChatLayout />} />
      </Routes>
    </HashRouter>
  )
}
