import React, { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Clock, GripVertical, RefreshCw, Pencil } from 'lucide-react'
import { Task } from '@/data/ports/schemas'
import { cn } from '@/lib/utils'

function getSidebarQuadrantBadge(quadrant: string | null | undefined) {
  switch (quadrant) {
    case 'q1':
    case 'do':
      return { label: 'Q1: Do', className: 'text-rose-400 bg-rose-500/10 border-rose-500/30' }
    case 'q2':
    case 'schedule':
      return { label: 'Q2: Schedule', className: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
    case 'q3':
    case 'delegate':
      return { label: 'Q3: Delegate', className: 'text-sky-400 bg-sky-500/10 border-sky-500/30' }
    case 'q4':
    case 'delete':
      return { label: 'Q4: Eliminate', className: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30' }
    default:
      return { label: 'Inbox', className: 'text-text-muted bg-surface-2 border-[rgba(255,255,255,0.08)]' }
  }
}

function getSidebarGTDBadge(gtd: string | null | undefined, gtdList: string | null | undefined) {
  const val = gtd || gtdList
  switch (val) {
    case 'next':
    case 'next_action':
      return { label: 'Next Action', className: 'text-action border-action/30 bg-action/10' }
    case 'scheduled':
      return { label: 'Scheduled', className: 'text-knowledge border-knowledge/30 bg-knowledge/10' }
    case 'waiting':
    case 'waiting_for':
      return { label: 'Waiting For', className: 'text-capital border-capital/30 bg-capital/10' }
    case 'someday':
      return { label: 'Someday', className: 'text-text-muted border-[rgba(255,255,255,0.08)] bg-surface-2' }
    default:
      return null
  }
}

/**
 * Task 1: Smart Sort for Unscheduled Tasks Sidebar
 * Priority: q1 > q2 > q3 > uncategorized > q4
 */
function getQuadrantPriorityRank(quadrant: string | null | undefined): number {
  switch (quadrant) {
    case 'q1':
    case 'do':
      return 1 // Q1 (Do)
    case 'q2':
    case 'schedule':
      return 2 // Q2 (Schedule)
    case 'q3':
    case 'delegate':
      return 3 // Q3 (Delegate)
    case 'q4':
    case 'delete':
      return 5 // Q4 (Eliminate)
    default:
      return 4 // Uncategorized / Inbox
  }
}

interface DraggableSidebarTaskProps {
  task: Task
  isHighlighted?: boolean
  onEdit?: (task: Task) => void
}

const DraggableSidebarTask: React.FC<DraggableSidebarTaskProps> = ({
  task,
  isHighlighted = false,
  onEdit,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  })

  const qBadge = getSidebarQuadrantBadge(task.quadrant)
  const gtdBadge = getSidebarGTDBadge(task.gtd, task.gtdList)

  return (
    <div
      ref={setNodeRef}
      style={{ touchAction: 'none' }}
      {...attributes}
      {...listeners}
      data-testid={isHighlighted ? 'highlighted-task-card' : undefined}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (!isDragging) {
          onEdit?.(task)
        }
      }}
      className={cn(
        'group card p-3 relative cursor-grab active:cursor-grabbing select-none',
        'border transition-all duration-300 flex items-start space-x-2 touch-none',
        isHighlighted
          ? 'ring-2 ring-emerald-500/50 bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10 animate-pulse'
          : 'border-[rgba(255,255,255,0.06)] bg-surface hover:bg-surface-2/60 hover:border-border-strong',
        isDragging && 'opacity-30 border-action/40 ring-1 ring-action/40 pointer-events-none'
      )}
    >
      <GripVertical
        className={cn(
          'w-4 h-4 shrink-0 mt-0.5 transition-colors',
          isHighlighted ? 'text-emerald-400' : 'text-text-faint group-hover:text-action'
        )}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-xs font-medium text-text leading-snug truncate flex items-center gap-1.5 min-w-0 flex-1">
            {(task.recallGroupId || task.srsGroupId) && (
              <span
                className="inline-flex items-center text-action/80 hover:text-action shrink-0"
                title={
                  (task.recallRole || task.srsRole) === 'parent'
                    ? 'Recall Loop: Base Task'
                    : 'Recall Loop: Review Task'
                }
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </span>
            )}
            <span className="truncate">{task.title}</span>
            {isHighlighted && (
              <span className="shrink-0 ml-1 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono font-bold uppercase">
                Target
              </span>
            )}
          </p>

          {/* Edit Task Action Button */}
          {onEdit && (
            <button
              type="button"
              data-testid={`edit-task-btn-${task.id}`}
              aria-label={`Edit ${task.title}`}
              title="Edit Task"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(task)
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1 -mr-1 -mt-0.5 rounded text-text-faint hover:text-text hover:bg-surface-2 transition-colors shrink-0 opacity-80 group-hover:opacity-100"
            >
              <Pencil className="w-3.5 h-3.5 text-text-muted hover:text-action" />
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
          {/* Restored Quadrant Badge */}
          <span
            data-testid={`sidebar-quadrant-${task.id}`}
            className={cn('px-1.5 py-0.2 rounded border font-medium', qBadge.className)}
          >
            {qBadge.label}
          </span>

          {/* Restored GTD Badge */}
          {gtdBadge && (
            <span
              data-testid={`sidebar-gtd-${task.id}`}
              className={cn('px-1.5 py-0.2 rounded border font-medium', gtdBadge.className)}
            >
              {gtdBadge.label}
            </span>
          )}

          <span className="px-1.5 py-0.2 rounded bg-surface-2 text-text-faint flex items-center space-x-1">
            <Clock className="w-3 h-3 text-action" />
            <span>{task.estimateMin || 45}m</span>
          </span>

          <span className="px-1.5 py-0.2 rounded border border-[rgba(255,255,255,0.06)] text-text-muted capitalize">
            {task.priority}
          </span>
        </div>
      </div>
    </div>
  )
}

interface UnscheduledTasksSidebarProps {
  tasks: Task[]
  selectedDate?: string
  scheduledTaskIds?: Set<string>
  onEditTask?: (task: Task) => void
}

export const UnscheduledTasksSidebar: React.FC<UnscheduledTasksSidebarProps> = ({
  tasks,
  selectedDate,
  scheduledTaskIds,
  onEditTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unscheduled-sidebar',
    data: {
      type: 'unscheduled-sidebar',
    },
  })

  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')

  const now = new Date()
  const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const targetDate = selectedDate || localTodayStr
  const isViewingToday = targetDate === localTodayStr

  // Context-aware Unscheduled Tasks filter:
  // 1. Strictly filter out permanently deleted tasks
  // 2. Strictly filter out tasks already scheduled on the grid via a TimeBlock
  // 3. IF selectedDate IS TODAY: status !== 'done', startTime is null, AND (scheduledDate <= localTodayStr || !scheduledDate)
  // 4. IF selectedDate IS NOT TODAY: status !== 'done', startTime is null, AND (scheduledDate === selectedDate)
  const unscheduledTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Eradicate ghost / permanently deleted tasks
      if (
        !t ||
        (t as unknown as { isDeleted?: boolean }).isDeleted === true ||
        (t as unknown as { deleted?: boolean }).deleted === true ||
        (t.status as string) === 'trashed' ||
        (t.status as string) === 'deleted'
      ) {
        return false
      }

      if (t.status === 'done') return false

      // 2. If already scheduled into a TimeBlock on the grid, do not show in unscheduled list
      if (scheduledTaskIds?.has(t.id)) {
        return false
      }

      // 3. startTime must be explicitly null, undefined, or empty
      if (t.startTime !== null && t.startTime !== undefined && t.startTime.trim() !== '') {
        return false
      }

      // 4. Date check
      const taskDate = (t.scheduledDate || t.dueDate)?.trim().split('T')[0]

      if (isViewingToday) {
        // Today: Overdue carry-over + today's tasks + unscheduled tasks without a date
        return !taskDate || taskDate <= localTodayStr
      } else {
        // Not Today: strictly tasks scheduled for this specific date
        return taskDate === targetDate
      }
    })
  }, [tasks, targetDate, isViewingToday, localTodayStr, scheduledTaskIds])

  // Task 1: Smart Sort for Unscheduled Tasks Sidebar
  // 1. Pinned highlight target (always first)
  // 2. Primary Sort: Quadrant priority (q1 > q2 > q3 > uncategorized > q4)
  // 3. Secondary Sort: Chronological (by updatedAt or createdAt descending)
  const sortedTasks = useMemo(() => {
    return [...unscheduledTasks].sort((a, b) => {
      if (highlightId) {
        if (a.id === highlightId) return -1
        if (b.id === highlightId) return 1
      }

      // 1. Primary Sort by Quadrant Priority
      const rankA = getQuadrantPriorityRank(a.quadrant)
      const rankB = getQuadrantPriorityRank(b.quadrant)
      if (rankA !== rankB) {
        return rankA - rankB
      }

      // 2. Secondary Sort: Chronological (updatedAt or createdAt descending)
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return timeB - timeA
    })
  }, [unscheduledTasks, highlightId])

  return (
    <div
      ref={setNodeRef}
      id="unscheduled-sidebar"
      data-testid="unscheduled-tasks-sidebar"
      className={cn(
        'card p-3 sm:p-4 bg-surface/50 border flex flex-col h-full max-h-[35vh] md:max-h-none overflow-hidden transition-all duration-200',
        isOver
          ? 'border-action ring-2 ring-action/50 bg-action/5'
          : 'border-[rgba(255,255,255,0.06)]'
      )}
    >
      <div className="pb-3 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-text">Tasks to Schedule</h2>
          <p className="text-[11px] text-text-faint mt-0.5">
            Drag a task onto the schedule to block time
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full font-mono text-xs font-semibold bg-action/10 text-action">
          {sortedTasks.length}
        </span>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
        {sortedTasks.map((task) => (
          <DraggableSidebarTask
            key={task.id}
            task={task}
            isHighlighted={task.id === highlightId}
            onEdit={onEditTask}
          />
        ))}

        {sortedTasks.length === 0 && (
          <div className="p-6 text-center text-xs text-text-faint border border-dashed border-[rgba(255,255,255,0.08)] rounded-tile">
            {isViewingToday
              ? 'All tasks are scheduled for today!'
              : `No tasks to schedule for ${targetDate}`}
          </div>
        )}
      </div>
    </div>
  )
}
