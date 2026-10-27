import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useDraggable } from '@dnd-kit/core'
import { Trash2, Pencil, Calendar, RotateCw, Check, AlertCircle, CalendarMinus } from 'lucide-react'
import { toast } from 'sonner'
import { PositionedTimeBlock } from './layoutBlocks'
import { Task, TimeBlock, TimeBlockCategory } from '@/data/ports/schemas'
import { useTaskStore } from '@/app/store/taskStore'
import { isCalendarTokenValid } from '@/services/calendar'
import { repos } from '@/data'
import { useDeleteTask } from '../useTasks'
import { useDeleteTimeBlock } from '../useTimeBlocks'
import { cn } from '@/lib/utils'

interface TimeBlockCardProps {
  positioned: PositionedTimeBlock
  onDelete?: (id: string) => void
  onEdit?: (block: TimeBlock) => void
  isDropTargetBlocked?: boolean
  isRecall?: boolean
  isSRS?: boolean
  allTasks?: Task[]
}

function getCategoryStyles(category: TimeBlockCategory, isFromGCal: boolean) {
  if (isFromGCal) {
    // Minimalist Dark Gray theme: solid distinct color strip, no glowing borders
    return {
      border: 'border-l-2 border-l-slate-400 border-border',
      bg: 'bg-surface-2 hover:bg-surface-3',
      text: 'text-slate-300',
    }
  }

  switch (category) {
    case 'deep_work':
      return {
        border: 'border-l-4 border-l-action border-border/80',
        bg: 'bg-action/10 hover:bg-action/15',
        text: 'text-action',
      }
    case 'learning':
      return {
        border: 'border-l-4 border-l-knowledge border-border/80',
        bg: 'bg-knowledge/10 hover:bg-knowledge/15',
        text: 'text-knowledge',
      }
    case 'recovery':
    case 'personal':
      return {
        border: 'border-l-4 border-l-growth border-border/80',
        bg: 'bg-growth/10 hover:bg-growth/15',
        text: 'text-growth',
      }
    case 'admin':
      return {
        border: 'border-l-4 border-l-capital border-border/80',
        bg: 'bg-capital/10 hover:bg-capital/15',
        text: 'text-capital',
      }
    case 'meeting':
      return {
        border: 'border-l-4 border-l-[#94A3B8] border-border/80',
        bg: 'bg-surface-2 hover:bg-surface-2/80',
        text: 'text-[#94A3B8]',
      }
    case 'external':
      return {
        border: 'border-l-2 border-l-slate-400 border-border',
        bg: 'bg-surface-2 hover:bg-surface-3',
        text: 'text-slate-300',
      }
  }
}

function formatTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export const TimeBlockCard: React.FC<TimeBlockCardProps> = ({
  positioned,
  onDelete,
  onEdit,
  isDropTargetBlocked = false,
  isRecall = false,
  isSRS = false,
  allTasks,
}) => {
  const { block, topPx, heightPx, leftPct, widthPct, isCrossOver } = positioned
  const isFromGCal = block.source === 'gcal' || block.category === 'external'
  const isGCalActive = isCalendarTokenValid()
  const isQueuedToPush = isGCalActive && !isFromGCal && !block.gcal?.eventId
  const isSyncedToGCal = !isFromGCal && !!block.gcal?.eventId
  const isRecallBlock = Boolean(block.recallGroupId || block.srsGroupId || isRecall || isSRS)

  // Determine if this scheduled task was originally overdue
  const tasksFromStore = useTaskStore((s) => s.tasks)
  const taskList = allTasks && allTasks.length > 0 ? allTasks : tasksFromStore
  // Strictly filter out permanently deleted / ghost tasks
  const liveTaskList = taskList.filter((t) => {
    if (!t) return false
    if ((t as unknown as { isDeleted?: boolean }).isDeleted === true) return false
    if ((t as unknown as { deleted?: boolean }).deleted === true) return false
    if ((t.status as string) === 'trashed' || (t.status as string) === 'deleted') return false
    return true
  })
  const linkedTask = block.taskId ? liveTaskList.find((t) => t.id === block.taskId) : undefined
  const isTaskDone =
    linkedTask?.status === 'done' ||
    (block as unknown as { status?: string }).status === 'done'

  const originalDate =
    linkedTask?.scheduledDate ||
    linkedTask?.dueDate ||
    (block as unknown as { scheduledDate?: string; dueDate?: string }).scheduledDate ||
    (block as unknown as { scheduledDate?: string; dueDate?: string }).dueDate

  const now = new Date()
  const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const isOverdue = Boolean(
    !isTaskDone &&
      originalDate &&
      typeof originalDate === 'string' &&
      originalDate.trim().split('T')[0] < localTodayStr
  )

  const styles = getCategoryStyles(block.category, isFromGCal)
  const borderClass = isOverdue
    ? 'border-l-4 !border-l-red-500 border-border/80'
    : styles.border

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [popoverCoords, setPopoverCoords] = useState<{
    top?: number
    bottom?: number
    right: number
  } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const deleteTask = useTaskStore((s) => s.deleteTask)
  const deleteTaskMutation = useDeleteTask()
  const deleteBlockMutation = useDeleteTimeBlock()

  useEffect(() => {
    if (!isMenuOpen) return

    let isAttached = false
    const attachTimer = setTimeout(() => {
      isAttached = true
    }, 100)

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    const handleScroll = (event: Event) => {
      if (!isAttached) return
      if (menuRef.current && menuRef.current.contains(event.target as Node)) {
        return
      }
      setIsMenuOpen(false)
    }

    const handleResize = () => {
      setIsMenuOpen(false)
    }

    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      clearTimeout(attachTimer)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isMenuOpen])

  const handleUnschedule = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMenuOpen(false)

    if (isTaskDone) {
      toast.info('Completed tasks cannot be unscheduled', {
        description: 'Completed tasks are preserved as historical records.',
      })
      return
    }

    if (block.taskId) {
      useTaskStore.getState().unscheduleTask(block.taskId)
    }

    if (onDelete) {
      onDelete(block.id)
    } else {
      deleteBlockMutation.mutate(block.id)
    }

    if (block.taskId) {
      toast.success('Task unscheduled', {
        description: 'Moved back to unscheduled tasks sidebar',
      })
    } else {
      toast.success('Time block removed')
    }
  }

  const handleDeletePermanently = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMenuOpen(false)

    if (block.taskId) {
      deleteTask(block.taskId)
      try {
        await deleteTaskMutation.mutateAsync(block.taskId)
      } catch {
        await repos.tasks.remove(block.taskId)
      }
      toast.success('Task deleted permanently')
    } else {
      toast.success('Time block deleted')
    }

    if (onDelete) {
      onDelete(block.id)
    } else {
      deleteBlockMutation.mutate(block.id)
    }
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
    data: {
      type: 'TimeBlock',
      block,
    },
    disabled: isTaskDone,
  })

  const isShortBlock = heightPx <= 36
  const timeLabel = isCrossOver
    ? `00:00 – ${formatTime(block.end)} (rollover)`
    : `${formatTime(block.start)} – ${formatTime(block.end)}`

  return (
    <div
      ref={setNodeRef}
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        pointerEvents: isDragging || isDropTargetBlocked ? 'none' : 'auto',
        zIndex: isDragging ? 30 : isMenuOpen ? 50 : isDropTargetBlocked ? 0 : 20,
        touchAction: 'none',
      }}
      {...attributes}
      {...(!isTaskDone ? listeners : {})}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (isMenuOpen) {
          e.stopPropagation()
          setIsMenuOpen(false)
          return
        }
        onEdit?.(block)
      }}
      className={cn(
        'absolute rounded-xl border',
        isTaskDone ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        'transition-all duration-150 group flex flex-col select-none touch-none shadow-sm overflow-hidden',
        isShortBlock ? 'px-2 py-0.5 justify-center' : 'p-2 justify-between',
        borderClass,
        styles.bg,
        isFromGCal ? 'bg-surface-2 shadow-none' : 'backdrop-blur-md',
        isDragging && 'opacity-30 ring-1 ring-action',
        isTaskDone && 'opacity-50'
      )}
    >
      {/* Header Row: flex flex-row items-center justify-between w-full */}
      <div className="flex flex-row items-center justify-between w-full gap-2">
        {/* Title Section: flex items-center vertically centered with icon/dot */}
        <div className="flex items-center space-x-1.5 min-w-0 flex-1">
          {isFromGCal && (
            <span className="p-0.5 rounded bg-surface border border-border text-slate-400 shrink-0">
              <Calendar className="w-3 h-3" />
            </span>
          )}
          {isRecallBlock && (
            <span
              className="p-0.5 rounded bg-action/15 border border-action/30 text-action shrink-0"
              title="Recall Loop"
            >
              <RotateCw className="w-2.5 h-2.5" />
            </span>
          )}
          {isOverdue && (
            <span
              data-testid="overdue-block-indicator"
              className="p-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-400 shrink-0"
              title={`Recovered Overdue Task (${originalDate?.trim().split('T')[0]})`}
            >
              <AlertCircle className="w-2.5 h-2.5 text-red-500" />
            </span>
          )}
          {isTaskDone && (
            <span
              data-testid="done-block-indicator"
              className="p-0.5 rounded bg-growth/15 border border-growth/30 text-growth shrink-0"
              title="Task Completed"
            >
              <Check className="w-2.5 h-2.5 text-growth" />
            </span>
          )}
          {isCrossOver && (
            <span
              data-testid="crossover-badge"
              className="px-1 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-mono font-bold shrink-0"
              title="Carried over from yesterday"
            >
              Rollover
            </span>
          )}
          <p
            className={cn(
              'text-xs font-semibold leading-tight truncate text-text',
              isTaskDone && 'line-through text-text-muted'
            )}
          >
            {block.title}
          </p>
          {isShortBlock && (
            <span className="text-[10px] font-mono text-text-muted shrink-0">
              {timeLabel}
            </span>
          )}
        </div>

        {/* Actions Container: flex flex-row items-center gap-2 */}
        <div
          className="flex flex-row items-center gap-2 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {onEdit && (
            <button
              type="button"
              aria-label="Edit block"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(block)
              }}
              className="p-1 rounded text-text-muted hover:text-text hover:bg-surface transition-colors"
              title="Edit block"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Action Popover Trigger (Trash/Remove Icon) */}
          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              data-testid={`block-menu-trigger-${block.id}`}
              aria-label="Block options"
              aria-haspopup="true"
              aria-expanded={isMenuOpen}
              onClick={(e) => {
                e.stopPropagation()
                if (!isMenuOpen && triggerRef.current) {
                  triggerRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' })
                  const rect = triggerRef.current.getBoundingClientRect()
                  const menuEstimatedHeight = 85
                  const right = Math.max(8, window.innerWidth - rect.right)

                  if (rect.top >= 0 && rect.top <= window.innerHeight) {
                    if (rect.top >= menuEstimatedHeight + 8) {
                      setPopoverCoords({
                        bottom: window.innerHeight - rect.top + 8,
                        right,
                      })
                    } else {
                      setPopoverCoords({
                        top: rect.bottom + 8,
                        right,
                      })
                    }
                  } else {
                    setPopoverCoords({
                      top: Math.max(60, Math.min(window.innerHeight - menuEstimatedHeight - 20, 200)),
                      right,
                    })
                  }
                  setIsMenuOpen(true)
                } else {
                  setIsMenuOpen(false)
                }
              }}
              className={cn(
                'p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors',
                isMenuOpen && 'bg-danger/15 text-danger ring-1 ring-danger/30'
              )}
              title="Block options"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* For taller blocks (> 36px), display timeLabel and footer badges */}
      {!isShortBlock && (
        <>
          <p className="text-[10px] font-mono mt-0.5 text-text-muted">
            {timeLabel}
          </p>

          {heightPx > 50 && (
            <div className="flex flex-wrap items-center gap-1.5 self-start mt-1">
              {/* Category Pill */}
              <span
                className={cn(
                  'uppercase tracking-wider font-mono text-[9px] px-1.5 py-0.2 rounded border border-[rgba(255,255,255,0.06)] bg-surface/80',
                  styles.text
                )}
              >
                {block.category.replace('_', ' ')}
              </span>

              {/* Completed Status Pill */}
              {isTaskDone && (
                <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-growth/15 text-growth border border-growth/30 font-medium">
                  Done
                </span>
              )}

              {/* GCal External Indicator */}
              {isFromGCal && (
                <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-surface border border-border text-slate-300 font-medium">
                  Google Calendar
                </span>
              )}

              {/* GCal Queuing Status Indicator */}
              {isQueuedToPush && (
                <span
                  className="inline-flex items-center space-x-1 text-[9px] font-mono text-sky-400 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-800/50"
                  title="Queued to sync to Google Calendar"
                >
                  <RotateCw className="w-2.5 h-2.5 animate-spin" />
                  <span>Queued for GCal</span>
                </span>
              )}

              {/* GCal Synced Status Indicator */}
              {isSyncedToGCal && (
                <span
                  className="inline-flex items-center space-x-1 text-[9px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-800/50"
                  title="Synchronized with Google Calendar"
                >
                  <Check className="w-2.5 h-2.5" />
                  <span>Synced</span>
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* Action Popover in React Portal (breaks out of scroll container) */}
      {isMenuOpen && popoverCoords && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            data-testid={`block-action-popover-${block.id}`}
            role="menu"
            aria-label="Time block actions"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              zIndex: 100,
              ...(popoverCoords.bottom !== undefined ? { bottom: `${popoverCoords.bottom}px` } : {}),
              ...(popoverCoords.top !== undefined ? { top: `${popoverCoords.top}px` } : {}),
              right: `${popoverCoords.right}px`,
            }}
            className={cn(
              'w-44 select-none',
              'bg-surface/95 backdrop-blur-md border border-[rgba(255,255,255,0.12)]',
              'rounded-xl shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-100'
            )}
          >
            {/* Option A: Unschedule (Hidden for completed tasks) */}
            {!isTaskDone && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  data-testid="unschedule-block-btn"
                  onClick={handleUnschedule}
                  className={cn(
                    'w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                    'text-text-muted hover:text-text hover:bg-surface-2 transition-colors text-left group/opt'
                  )}
                >
                  <CalendarMinus className="w-3.5 h-3.5 text-text-muted group-hover/opt:text-action transition-colors shrink-0" />
                  <span className="truncate">Unschedule</span>
                </button>

                {/* Divider */}
                <div className="h-px bg-[rgba(255,255,255,0.06)] my-1" />
              </>
            )}

            {/* Option B: Delete Permanently */}
            <button
              type="button"
              role="menuitem"
              data-testid="delete-permanently-btn"
              onClick={handleDeletePermanently}
              className={cn(
                'w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                'text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left group/opt'
              )}
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400 group-hover/opt:text-red-300 transition-colors shrink-0" />
              <span className="truncate">Delete Permanently</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}
