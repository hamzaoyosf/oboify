import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Clock, CheckCircle2, Circle, Trash2, RefreshCw, AlertCircle, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { Task, Priority, GTDList, TaskStatus } from '@/data/ports/schemas'
import { useUpdateTask, useDeleteTask } from './useTasks'
import { getRecallCardStep } from '@/app/store/taskStore'
import { cn } from '@/lib/utils'

interface TaskCardProps {
  task: Task
  isOverlay?: boolean
  onEdit?: (task: Task) => void
}

function getPriorityBadge(priority: Priority) {
  switch (priority) {
    case 'high':
      return {
        label: 'High',
        className: 'text-danger bg-danger/10 border-danger/30',
      }
    case 'medium':
      return {
        label: 'Med',
        className: 'text-capital bg-capital/10 border-capital/30',
      }
    case 'low':
      return {
        label: 'Low',
        className: 'text-text-muted bg-surface-2 border-[rgba(255,255,255,0.08)]',
      }
  }
}

function getGTDListBadge(gtdList: GTDList | string | undefined) {
  switch (gtdList) {
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
      return { label: 'Next Action', className: 'text-action border-action/30 bg-action/10' }
  }
}

/**
 * Task: Persistent Recall Colors (Remove Hover Dependency)
 * - Parent/Base Recall: Blue (border border-blue-500 border-l-4 bg-blue-500/10)
 * - 1st Recall (24h): Yellow/Gold (border border-yellow-500 border-l-4 bg-yellow-500/10)
 * - 2nd Recall (2 weeks): Orange (border border-orange-500 border-l-4 bg-orange-500/10)
 * - 3rd Recall (2 months): Green (border border-emerald-500 border-l-4 bg-emerald-500/10)
 * - Normal Tasks: Default styling
 */
interface RecallVisualConfig {
  borderClass: string
  bgClass: string
}

function getRecallVisualConfig(task: Task): RecallVisualConfig | null {
  const isRecall = Boolean(
    task.isRecall ||
    task.recallRole ||
    task.recallGroupId ||
    task.srsRole ||
    task.srsGroupId
  )
  if (!isRecall) return null

  const isParent =
    task.recallRole === 'parent' ||
    task.srsRole === 'parent' ||
    (task.tags?.includes('recall-parent') ?? false) ||
    (!task.recallRole && !task.srsRole && !task.title?.match(/(1st|2nd|3rd)\s+(Recall|Review)/i))

  if (isParent) {
    return {
      borderClass: 'border border-blue-500 border-l-4',
      bgClass: 'bg-blue-500/10',
    }
  }

  const step = getRecallCardStep(task)
  if (step === 1) {
    return {
      borderClass: 'border border-yellow-500 border-l-4',
      bgClass: 'bg-yellow-500/10',
    }
  }
  if (step === 2) {
    return {
      borderClass: 'border border-orange-500 border-l-4',
      bgClass: 'bg-orange-500/10',
    }
  }
  if (step === 3) {
    return {
      borderClass: 'border border-emerald-500 border-l-4',
      bgClass: 'bg-emerald-500/10',
    }
  }

  return {
    borderClass: 'border border-blue-500 border-l-4',
    bgClass: 'bg-blue-500/10',
  }
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, isOverlay = false, onEdit }) => {
  const updateMutation = useUpdateTask()
  const deleteMutation = useDeleteTask()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
    disabled: isOverlay,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'none',
  }

  const priorityMeta = getPriorityBadge(task.priority)
  const gtdMeta = getGTDListBadge(task.gtdList)
  const isDone = task.status === 'done'
  const recallMeta = getRecallVisualConfig(task)

  // Task 3: Visual Guilt (Overdue UI) for Recall Tasks
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const taskDateStr = (task.scheduledDate || task.dueDate || '').trim().split('T')[0]
  const isRecallTask = Boolean(task.recallRole || task.recallGroupId || task.srsRole || task.srsGroupId)
  const isOverdueRecall = Boolean(isRecallTask && !isDone && taskDateStr && taskDateStr < todayStr)

  // Visual Time-Block Indicator on Schedule / Timeline
  const scheduledStartTime =
    task.startTime?.trim() ||
    (task.scheduledDate?.includes('T') && !task.scheduledDate.endsWith('T00:00:00.000Z')
      ? task.scheduledDate.split('T')[1].slice(0, 5)
      : null)
  const isTimeBlocked = Boolean(scheduledStartTime && scheduledStartTime.length > 0)

  const handleToggleDone = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextStatus = (isDone ? (task.previousStatus || 'draft') : 'done') as TaskStatus
    updateMutation.mutate({
      id: task.id,
      patch: {
        status: nextStatus,
        completedAt: nextStatus === 'done' ? new Date().toISOString() : null,
        previousStatus: !isDone ? task.status : null,
      },
    })
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    deleteMutation.mutate(task.id)
  }

  const completedSubtasks = task.subtasks?.filter((s) => s.done).length || 0
  const totalSubtasks = task.subtasks?.length || 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => onEdit?.(task)}
      className={cn(
        'group p-2.5 sm:p-3 relative cursor-grab active:cursor-grabbing select-none touch-none transition-colors rounded-card shadow-card',
        recallMeta
          ? cn(recallMeta.borderClass, recallMeta.bgClass)
          : 'card border border-[rgba(255,255,255,0.06)] bg-surface hover:bg-surface-2/60 hover:border-border-strong',
        isDragging && 'opacity-30 border-action/40',
        isOverlay && 'shadow-2xl border-action/50 bg-surface-2 ring-1 ring-action/50 cursor-grabbing rotate-1',
        isDone && 'opacity-60 bg-surface/30',
        isOverdueRecall && 'border-danger/70 bg-danger/[0.04] shadow-[0_0_12px_rgba(244,63,94,0.18)] hover:border-danger'
      )}
      data-hub={recallMeta ? undefined : 'action'}
    >
      {/* Top Header: Checkbox + Title + Actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start space-x-2.5 min-w-0">
          <button
            type="button"
            onClick={handleToggleDone}
            className="mt-0.5 text-text-faint hover:text-action transition-colors shrink-0"
            title={isDone ? 'Mark as incomplete' : 'Mark as done'}
          >
            {isDone ? (
              <CheckCircle2 className="w-4 h-4 text-growth" />
            ) : (
              <Circle className="w-4 h-4" />
            )}
          </button>

          <span
            className={cn(
              'text-sm font-medium leading-snug break-words text-text flex items-baseline flex-wrap',
              isDone && 'line-through text-text-muted',
              isOverdueRecall && 'text-danger'
            )}
          >
            {isRecallTask && (
              <span
                className={cn(
                  'inline-flex items-center shrink-0 mr-1.5 self-center transition-colors',
                  isOverdueRecall ? 'text-danger animate-pulse' : 'text-action/80 hover:text-action'
                )}
                title={
                  isOverdueRecall
                    ? 'Recall Overdue! Review loop is at risk'
                    : (task.recallRole || task.srsRole) === 'parent'
                    ? 'Recall Loop: Base Task'
                    : 'Recall Loop: Review Task'
                }
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </span>
            )}
            <span>{task.title}</span>
          </span>
        </div>

        {/* Hover Delete Action */}
        <button
          type="button"
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 p-1 text-text-faint hover:text-danger rounded hover:bg-danger/10 transition-opacity"
          title="Delete task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Notes preview */}
      {task.notes && (
        <p className="mt-1.5 ml-6.5 text-xs text-text-muted line-clamp-2 leading-relaxed">
          {task.notes}
        </p>
      )}

      {/* Metadata Badges */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-[rgba(255,255,255,0.04)] text-[11px] font-mono">
        {/* Overdue Warning Badge (Visual Guilt) */}
        {isOverdueRecall && (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-chip border border-danger/40 bg-danger/10 text-danger text-[10px] font-semibold">
            <AlertCircle className="w-3 h-3" />
            <span>Overdue ({taskDateStr})</span>
          </span>
        )}

        {/* GTD List */}
        <span
          className={cn(
            'px-1.5 py-0.5 rounded-chip border text-[10px] font-medium tracking-wide',
            gtdMeta.className
          )}
        >
          {gtdMeta.label}
        </span>

        {/* Priority */}
        <span
          className={cn(
            'px-1.5 py-0.5 rounded-chip border text-[10px] uppercase font-semibold tracking-wider',
            priorityMeta.className
          )}
        >
          {priorityMeta.label}
        </span>

        {/* Time-blocked on Timeline Indicator */}
        {isTimeBlocked && (
          <span
            data-testid={`time-blocked-badge-${task.id}`}
            className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-chip border border-blue-500/40 bg-blue-500/10 text-blue-400 text-[10px] font-semibold"
            title={`Time-blocked at ${scheduledStartTime}${taskDateStr ? ` on ${taskDateStr}` : ''}`}
          >
            <Calendar className="w-3 h-3 text-blue-400 shrink-0" />
            <span>{scheduledStartTime}</span>
          </span>
        )}

        {/* Estimate */}
        {task.estimateMin && task.estimateMin > 0 ? (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-surface-2 text-text-faint text-[10px]">
            <Clock className="w-3 h-3" />
            <span>{task.estimateMin}m</span>
          </span>
        ) : null}

        {/* Scheduled / Due Date when not overdue */}
        {!isOverdueRecall && taskDateStr && (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-surface-2 text-text-faint text-[10px]">
            <Calendar className="w-3 h-3" />
            <span>{taskDateStr}</span>
          </span>
        )}

        {/* Subtask count */}
        {totalSubtasks > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-surface-2 text-text-faint text-[10px]">
            {completedSubtasks}/{totalSubtasks}
          </span>
        )}
      </div>
    </div>
  )
}
