import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Task } from '@/data/ports/schemas'
import { TaskCard } from './TaskCard'
import { cn } from '@/lib/utils'

interface KanbanColumnProps {
  id: string
  title: string
  icon: React.ReactNode
  accentColor: string
  tasks: Task[]
  onEditTask?: (task: Task) => void
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id,
  title,
  icon,
  accentColor,
  tasks,
  onEditTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'column',
      columnId: id,
    },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-h-[300px] md:min-h-0 h-auto md:h-full rounded-card bg-surface/50 border border-[rgba(255,255,255,0.06)] overflow-hidden',
        'transition-colors duration-150',
        isOver && 'border-action/40 bg-action/[0.02] ring-1 ring-action/20'
      )}
    >
      {/* Fixed Column Header */}
      <div className="shrink-0 p-3.5 sm:p-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-surface/80">
        <div className="flex items-center space-x-2">
          <span className="shrink-0" style={{ color: accentColor }}>
            {icon}
          </span>
          <h2 className="text-sm font-semibold tracking-wide text-text">{title}</h2>
        </div>

        <span
          className="px-2 py-0.5 rounded-full font-mono text-xs font-semibold"
          style={{
            backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
            color: accentColor,
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Task List Scrollable Body */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 flex flex-col space-y-2.5 min-h-[300px] md:min-h-0">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={onEditTask} />
          ))}

          {tasks.length === 0 && (
            <div
              className={cn(
                'flex-1 min-h-[140px] flex items-center justify-center rounded-tile',
                'border border-dashed border-[rgba(255,255,255,0.08)] text-xs text-text-faint',
                isOver && 'border-action text-action/70 bg-action/5'
              )}
            >
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}
