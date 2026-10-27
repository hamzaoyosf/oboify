import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { HubRail } from './HubRail'
import { MobileHeader } from './MobileHeader'
import { QuickCaptureModal } from '@/features/inbox/QuickCaptureModal'
import { CommandPalette } from '@/features/command/CommandPalette'
import { useUIStore } from '@/app/store/uiStore'
import { useTaskStore } from '@/app/store/taskStore'
import { repos } from '@/data'

export const BentoShell: React.FC = () => {
  // Preload tasks into store on workspace mount
  useEffect(() => {
    repos.tasks.list().then((items) => {
      if (items && items.length > 0) {
        useTaskStore.getState().setTasks(items)
      }
    }).catch(() => {})
  }, [])

  // Global keyboard shortcuts:
  // - Cmd+K / Ctrl+K opens Command Palette
  // - 'q' or 'i' opens Quick Capture (SRS FR-INB-01 / PRD AH-1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Check for Cmd+K / Ctrl+K Command Palette trigger
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useUIStore.getState().toggleCommandPalette()
        return
      }

      // Ignore single-key shortcuts when modifier keys are pressed
      if (e.ctrlKey || e.altKey || e.metaKey) return

      // Don't trigger if command palette or quick capture is already open
      const { isCommandPaletteOpen, isQuickCaptureOpen } = useUIStore.getState()
      if (isCommandPaletteOpen || isQuickCaptureOpen) return

      // Strictly verify that document.activeElement is not an INPUT or TEXTAREA
      const activeElement = document.activeElement as HTMLElement | null
      const activeTag = activeElement?.tagName?.toUpperCase()

      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeElement?.isContentEditable) {
        return
      }

      const key = e.key.toLowerCase()
      if (key === 'q' || key === 'i') {
        e.preventDefault()
        useUIStore.getState().openQuickCapture()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-bg text-text flex flex-col md:flex-row antialiased selection:bg-gray-700 selection:text-gray-100 w-full max-w-full">
      {/* Mobile Top Header (< md) */}
      <MobileHeader />

      {/* Left Navigation Sidebar (>= md) */}
      <HubRail />

      {/* Main Viewport Container */}
      <main className="flex-1 min-w-0 md:h-screen overflow-y-auto overflow-x-hidden pb-20 md:pb-6">
        <div className="max-w-[1440px] mx-auto w-full p-2 sm:p-3 md:p-4 lg:p-5">
          <React.Suspense
            fallback={
              <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-emerald-500 animate-spin" />
                <p className="text-xs font-mono uppercase tracking-wider text-text-muted">
                  Loading OBOiFY...
                </p>
              </div>
            }
          >
            <Outlet />
          </React.Suspense>
        </div>
      </main>

      {/* Global Quick Capture Modal */}
      <QuickCaptureModal />

      {/* Global Command Palette */}
      <CommandPalette />
    </div>
  )
}
