import React, { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ArrowRightLeft,
  AlertCircle,
  Sparkles,
  CreditCard,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Task, TimeBlock } from '@/data/ports/schemas'
import { useTasks } from '../useTasks'
import { useSubscriptions } from '@/features/capital/useSubscriptions'
import {
  useTimeBlocks,
  useDeleteTimeBlock,
  useSyncGoogleCalendar,
} from '../useTimeBlocks'
import { layoutTimeBlocks } from './layoutBlocks'
import { TimeGrid } from './TimeGrid'
import { UnscheduledTasksSidebar } from './UnscheduledTasksSidebar'
import { EditTimeBlockModal } from './EditTimeBlockModal'
import {
  CalendarSyncModal,
  isCalendarTokenValid,
  isCalendarTokenExpired,
  isCalendarConfigured,
} from '@/services/calendar'
import { cn } from '@/lib/utils'

interface TimelineViewProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  isDraggingActive?: boolean
  onEditTask?: (task: Task) => void
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  selectedDate,
  onSelectDate,
  isDraggingActive = false,
  onEditTask,
}) => {
  const year = selectedDate.getFullYear()
  const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
  const day = String(selectedDate.getDate()).padStart(2, '0')
  const selectedDateStr = `${year}-${month}-${day}`

  const { data: allTasks = [] } = useTasks()
  const { data: dayBlocks = [], isLoading } = useTimeBlocks(selectedDateStr)
  const { data: allSubscriptions = [] } = useSubscriptions('all')
  const deleteBlockMutation = useDeleteTimeBlock()
  const syncCalendarMutation = useSyncGoogleCalendar()

  // Eradicate Ghost Tasks: strictly filter out permanently deleted tasks
  const liveTasks = allTasks.filter((t) => {
    if (!t) return false
    if ((t as unknown as { isDeleted?: boolean }).isDeleted === true) return false
    if ((t as unknown as { deleted?: boolean }).deleted === true) return false
    if ((t.status as string) === 'trashed' || (t.status as string) === 'deleted') return false
    return true
  })

  // Eradicate Ghost Blocks: filter out timeblocks referencing deleted tasks
  const liveTaskIds = new Set(liveTasks.map((t) => t.id))
  const liveDayBlocks = dayBlocks.filter((b) => !b.taskId || liveTaskIds.has(b.taskId))

  const dayRenewals = allSubscriptions.filter(
    (s) => s.status === 'active' && s.nextRenewal === selectedDateStr
  )

  const [blockToEdit, setBlockToEdit] = useState<TimeBlock | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false)
  const [scrollTrigger, setScrollTrigger] = useState(0)

  const isGCalActive = isCalendarTokenValid()
  const isGCalExpired = isCalendarTokenExpired()
  const isGCalSetup = isCalendarConfigured()

  // Inbound sync on mount / date change if Google Calendar token is valid
  useEffect(() => {
    if (isCalendarTokenValid()) {
      syncCalendarMutation.mutate(selectedDateStr)
    }
  }, [selectedDateStr])

  const recallTaskIds = new Set(
    liveTasks.filter((t) => t.recallGroupId || t.srsGroupId).map((t) => t.id)
  )

  const scheduledTaskIds = new Set(
    liveDayBlocks.map((b) => b.taskId).filter(Boolean) as string[]
  )

  // Calculate side-by-side positioned blocks with pixel coordinates
  const positionedBlocks = layoutTimeBlocks(liveDayBlocks, selectedDateStr)

  // Date Navigation Helpers
  const handlePrevDay = () => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() - 1)
    onSelectDate(next)
  }

  const handleNextDay = () => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    onSelectDate(next)
  }

  const handleToday = () => {
    onSelectDate(new Date())
    setScrollTrigger((prev) => prev + 1)
  }

  const formattedDate = selectedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const now = new Date()
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isToday = selectedDateStr === localToday || selectedDateStr === now.toISOString().slice(0, 10)

  const handleOpenEdit = (block: TimeBlock) => {
    setBlockToEdit(block)
    setIsEditModalOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Subscription Renewal Alert for Selected Date */}
      {dayRenewals.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-text">
                Scheduled Subscription Renewal{dayRenewals.length > 1 ? 's' : ''} on this day:
              </span>{' '}
              <span className="text-text-muted">
                {dayRenewals
                  .map((r) => `${r.name} ($${(r.amountMinor / 100).toFixed(2)})`)
                  .join(', ')}
              </span>
            </div>
          </div>
          <Link
            to="/capital"
            className="font-mono text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center space-x-1"
          >
            <span>Review in Capital Hub →</span>
          </Link>
        </div>
      )}

      {/* Main Grid Area */}
      {isLoading ? (
        <div className="card p-8 animate-pulse bg-surface-2/40 h-[600px]" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 h-[calc(100vh-170px)] min-h-[550px] overflow-hidden">
          {/* Left: Unscheduled Tasks Sidebar (4 cols on lg) */}
          <div className="lg:col-span-4 h-full overflow-hidden flex flex-col">
            <UnscheduledTasksSidebar
              tasks={liveTasks}
              selectedDate={selectedDateStr}
              scheduledTaskIds={scheduledTaskIds}
              onEditTask={onEditTask}
            />
          </div>

          {/* Right: Daily Schedule Grid (8 cols on lg) */}
          <div className="lg:col-span-8 h-full overflow-hidden flex flex-col">
            {/* Consolidate Timeline Headers: Date Display, GCal Sync, and Navigation */}
            <div className="flex flex-row items-center justify-between mb-4">
              {/* Left side: The Calendar Icon, Date text, and "TODAY" subtext */}
              <div className="flex items-center space-x-3">
                <CalendarIcon className="w-5 h-5 text-action shrink-0" />
                <div>
                  <h2 className="text-base font-semibold text-text leading-tight">{formattedDate}</h2>
                  {isToday && (
                    <span className="text-[11px] font-mono text-action uppercase tracking-wider block">
                      Today
                    </span>
                  )}
                </div>
              </div>

              {/* Right side: Flex group containing the "Connect GCal" button and the < Today > navigation group */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Google Calendar Sync Pill & Trigger */}
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setIsCalendarModalOpen(true)}
                    className={cn(
                      'flex items-center space-x-1.5 px-3 py-1.5 rounded-chip text-xs font-mono border transition-all',
                      isGCalActive
                        ? 'bg-action/10 border-action/30 text-action hover:bg-action/20'
                        : isGCalExpired
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                        : 'bg-surface-2 border-[rgba(255,255,255,0.08)] text-text-muted hover:text-text'
                    )}
                    title="Manage Google Calendar 2-Way Sync"
                  >
                    {isGCalActive ? (
                      <>
                        <CalendarIcon className="w-3.5 h-3.5 text-action" />
                        <span>GCal Active</span>
                      </>
                    ) : isGCalExpired ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span>GCal Expired • Reconnect</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-action" />
                        <span>{isGCalSetup ? 'Connect GCal' : 'Setup GCal'}</span>
                      </>
                    )}
                  </button>

                  {isGCalActive && (
                    <button
                      type="button"
                      onClick={() => syncCalendarMutation.mutate(selectedDateStr)}
                      disabled={syncCalendarMutation.isPending}
                      className="p-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-surface-2 text-text-muted hover:text-action hover:border-action/40 transition-colors"
                      title="Sync 2-Way with Google Calendar Now"
                    >
                      <ArrowRightLeft
                        className={cn(
                          'w-3.5 h-3.5',
                          syncCalendarMutation.isPending && 'animate-spin text-action'
                        )}
                      />
                    </button>
                  )}
                </div>

                {/* Date Pagination */}
                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="p-1.5 rounded-lg border border-[rgba(255,255,255,0.06)] bg-surface-2 text-text-muted hover:text-text hover:bg-surface transition-colors"
                  title="Previous day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleToday}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all',
                    isToday
                      ? 'bg-action/20 text-action border-action/40'
                      : 'bg-surface-2 text-text-muted border-[rgba(255,255,255,0.06)] hover:text-text'
                  )}
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={handleNextDay}
                  className="p-1.5 rounded-lg border border-[rgba(255,255,255,0.06)] bg-surface-2 text-text-muted hover:text-text hover:bg-surface transition-colors"
                  title="Next day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TimeGrid */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <TimeGrid
                selectedDate={selectedDateStr}
                positionedBlocks={positionedBlocks}
                onDeleteBlock={(id) => deleteBlockMutation.mutate(id)}
                onEditBlock={handleOpenEdit}
                isDraggingActive={isDraggingActive}
                srsTaskIds={recallTaskIds}
                recallTaskIds={recallTaskIds}
                allTasks={liveTasks}
                scrollToNowTrigger={scrollTrigger}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit/Delete TimeBlock Modal */}
      <EditTimeBlockModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        block={blockToEdit}
      />

      {/* Google Calendar Sync Modal */}
      <CalendarSyncModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        selectedDate={selectedDateStr}
      />
    </div>
  )
}
