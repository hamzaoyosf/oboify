import React from 'react'
import { Link } from 'react-router-dom'
import { CheckSquare, ArrowUpRight, Clock, CheckCircle2, Circle } from 'lucide-react'
import { useTasks, useUpdateTask } from '@/features/action/useTasks'
import { useTimeBlocks } from '@/features/action/useTimeBlocks'
import { Task, TaskStatus, TimeBlock } from '@/data/ports/schemas'
import { cn } from '@/lib/utils'

export const ActionWidget: React.FC = () => {
  const { data: tasks = [] } = useTasks()
  const { data: timeBlocks = [] } = useTimeBlocks()
  const updateTaskMutation = useUpdateTask()

  // High leverage active tasks (draft or in_progress, sorted by priority)
  const activeTasks = tasks
    .filter((t: Task) => t.status !== 'done')
    .sort((a: Task, b: Task) => {
      const pOrder: Record<string, number> = { high: 1, medium: 2, low: 3 }
      const qOrder: Record<string, number> = { q1_do: 1, q2_plan: 2, q3_delegate: 3, q4_eliminate: 4 }
      const pDiff = (pOrder[a.priority] || 4) - (pOrder[b.priority] || 4)
      if (pDiff !== 0) return pDiff
      return (qOrder[a.quadrant || ''] || 5) - (qOrder[b.quadrant || ''] || 5)
    })
    .slice(0, 4)

  const completedTodayCount = tasks.filter((t: Task) => t.status === 'done').length

  // Filter timeblocks for today or upcoming
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayBlocks = timeBlocks
    .filter((b: TimeBlock) => b && typeof b.start === 'string' && b.start.startsWith(todayStr))
    .sort((a: TimeBlock, b: TimeBlock) => new Date(a?.start || 0).getTime() - new Date(b?.start || 0).getTime())
    .slice(0, 3)

  const handleToggleTask = (id: string, currentStatus: string) => {
    const targetTask = tasks.find((t: Task) => t.id === id)
    const isDone = currentStatus === 'done'
    const nextStatus = (isDone ? (targetTask?.previousStatus || 'draft') : 'done') as TaskStatus
    updateTaskMutation.mutate({
      id,
      patch: {
        status: nextStatus,
        completedAt: nextStatus === 'done' ? new Date().toISOString() : null,
        previousStatus: !isDone ? currentStatus : null,
      },
    })
  }

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch {
      return ''
    }
  }

  return (
    <div
      className="card p-5 bg-surface border border-border border-t-2 border-t-sky-400 hover:border-gray-600 hover:shadow-card-hover transition-all flex flex-col justify-between space-y-4"
      data-hub="action"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-lg bg-surface-2 text-sky-400 border border-border">
              <CheckSquare className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-text">Execution & Agenda</h2>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-400 font-mono font-medium border border-emerald-500/20">
                  {completedTodayCount} done
                </span>
              </div>
              <p className="text-[11px] text-text-faint font-mono">Action Hub</p>
            </div>
          </div>
          <Link
            to="/app/action"
            className="p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-surface-2 transition-colors"
            title="Open Action Hub"
          >
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Schedule Strip */}
        <div className="mt-3.5 space-y-2">
          <div className="flex items-center space-x-1.5 text-[11px] font-mono text-text-faint">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>TODAY&apos;S SCHEDULE ({todayBlocks.length})</span>
          </div>

          <div className="space-y-1.5">
            {todayBlocks.length === 0 ? (
              <p className="p-3 rounded-lg bg-surface-2/40 border border-border/50 text-center text-xs text-text-muted font-mono">
                No blocks scheduled for today. Drag tasks onto the timeline.
              </p>
            ) : (
              todayBlocks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-surface-2/60 border border-border text-xs"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                    <span className="font-medium text-text truncate">{b.title}</span>
                  </div>
                  <span className="font-mono text-[11px] text-text-muted shrink-0 ml-2">
                    {formatTime(b.start)} - {formatTime(b.end)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Priority Next Actions */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-text-faint">
            <span>PRIORITY EXECUTION</span>
            <span>{activeTasks.length} pending</span>
          </div>

          <div className="space-y-1.5">
            {activeTasks.length === 0 ? (
              <p className="p-3 rounded-lg bg-surface-2/40 border border-border/50 text-center text-xs text-text-muted font-mono">
                All priority tasks completed. Great velocity!
              </p>
            ) : (
              activeTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => handleToggleTask(t.id, t.status)}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2/50 hover:bg-surface-2 border border-border cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <button
                      type="button"
                      className="text-text-faint group-hover:text-emerald-400 transition-colors shrink-0"
                    >
                      {t.status === 'done' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <span
                      className={cn(
                        'text-xs truncate transition-all',
                        t.status === 'done'
                          ? 'line-through text-text-faint'
                          : 'text-text group-hover:text-white'
                      )}
                    >
                      {t.title}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0 ml-2 font-mono text-[10px]">
                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded font-semibold uppercase',
                        t.priority === 'high'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : t.priority === 'medium'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-surface-2 text-text-faint'
                      )}
                    >
                      {t.priority}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer Deep-Link */}
      <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
        <span className="text-text-faint font-mono text-[11px]">Kanban & Eisenhower</span>
        <Link
          to="/app/action"
          className="text-sky-400 hover:underline font-medium flex items-center space-x-1 text-xs font-mono"
        >
          <span>Open Hub</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  )
}
