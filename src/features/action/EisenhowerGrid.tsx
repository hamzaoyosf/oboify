import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { AlertCircle, Calendar, Users, Trash2, Inbox } from 'lucide-react'
import { Task } from '@/data/ports/schemas'
import { TaskCard } from './TaskCard'
import { cn } from '@/lib/utils'

interface EisenhowerQuadrantProps {
  id: string
  title: string
  subtitle: string
  icon: React.ReactNode
  accentColor: string
  tasks: Task[]
  onEditTask?: (task: Task) => void
  isTray?: boolean
}

const QuadrantBox: React.FC<EisenhowerQuadrantProps> = ({
  id,
  title,
  subtitle,
  icon,
  accentColor,
  tasks,
  onEditTask,
  isTray = false,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'quadrant',
      quadrantId: id === 'unassigned' || id === 'uncategorized' ? null : id === 'do' ? 'q1' : id === 'schedule' ? 'q2' : id === 'delegate' ? 'q3' : id === 'delete' ? 'q4' : id,
    },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-card bg-surface/50 border border-[rgba(255,255,255,0.06)] overflow-hidden',
        isTray ? 'shrink-0 min-h-[160px] max-h-[240px]' : 'min-h-[200px] max-h-[400px] flex-1 overflow-y-auto',
        'transition-colors duration-150',
        isOver && 'border-action/40 bg-action/[0.02] ring-1 ring-action/20'
      )}
    >
      {/* Fixed Header */}
      <div
        className={cn(
          'shrink-0 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-surface/80',
          isTray ? 'px-3 py-2 sm:px-3.5' : 'px-3 py-2.5 sm:px-3.5 sm:py-2.5'
        )}
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <span className="shrink-0" style={{ color: accentColor }}>
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold tracking-wide text-text leading-none truncate">{title}</h3>
            {!isTray && <p className="text-[10px] sm:text-[11px] text-text-faint mt-1 truncate">{subtitle}</p>}
          </div>
        </div>

        <span
          className="px-2 py-0.5 rounded-full font-mono text-xs font-semibold shrink-0 ml-2"
          style={{
            backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
            color: accentColor,
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Scrollable Body */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          className={cn(
            'flex-1 overflow-y-auto p-2 sm:p-2.5',
            isTray
              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2'
              : 'flex flex-col space-y-2'
          )}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={onEditTask} />
          ))}

          {tasks.length === 0 && (
            <div
              className={cn(
                'flex-1 min-h-[70px] flex items-center justify-center rounded-tile text-center px-4',
                isTray && 'col-span-full',
                'border border-dashed border-[rgba(255,255,255,0.08)] text-xs text-text-faint',
                isOver && 'border-action text-action/70 bg-action/5'
              )}
            >
              {isTray
                ? 'All tasks are assigned to a quadrant! Drag tasks here to unassign.'
                : 'Drop tasks into this quadrant'}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

interface EisenhowerGridProps {
  tasks: Task[]
  onEditTask?: (task: Task) => void
  selectedDate?: Date
}

export const EisenhowerGrid: React.FC<EisenhowerGridProps> = ({ tasks, onEditTask, selectedDate: _selectedDate }) => {
  const doTasks = tasks.filter((t) => t.quadrant === 'do' || t.quadrant === 'q1')
  const scheduleTasks = tasks.filter((t) => t.quadrant === 'schedule' || t.quadrant === 'q2')
  const delegateTasks = tasks.filter((t) => t.quadrant === 'delegate' || t.quadrant === 'q3')
  const deleteTasks = tasks.filter((t) => t.quadrant === 'delete' || t.quadrant === 'q4')
  const unassignedTasks = tasks.filter((t) => !t.quadrant || (t.quadrant as string) === 'uncategorized' || (t.quadrant as string) === 'unassigned')

  return (
    <div className="w-full flex flex-col gap-3 lg:gap-4">
      {/* 2x2 Priority Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
        {/* Q1: Urgent & Important -> Do */}
        <QuadrantBox
          id="do"
          title="Q1: Do"
          subtitle="Urgent & Important — Act immediately"
          icon={<AlertCircle className="w-4 h-4" />}
          accentColor="var(--danger)"
          tasks={doTasks}
          onEditTask={onEditTask}
        />

        {/* Q2: Not Urgent & Important -> Schedule */}
        <QuadrantBox
          id="schedule"
          title="Q2: Schedule"
          subtitle="Not Urgent & Important — Plan for deep work"
          icon={<Calendar className="w-4 h-4" />}
          accentColor="var(--action)"
          tasks={scheduleTasks}
          onEditTask={onEditTask}
        />

        {/* Q3: Urgent & Not Important -> Delegate */}
        <QuadrantBox
          id="delegate"
          title="Q3: Delegate"
          subtitle="Urgent & Not Important — Automate or hand off"
          icon={<Users className="w-4 h-4" />}
          accentColor="var(--capital)"
          tasks={delegateTasks}
          onEditTask={onEditTask}
        />

        {/* Q4: Not Urgent & Not Important -> Delete */}
        <QuadrantBox
          id="delete"
          title="Q4: Eliminate"
          subtitle="Not Urgent & Not Important — Drop or archive"
          icon={<Trash2 className="w-4 h-4" />}
          accentColor="var(--text-faint)"
          tasks={deleteTasks}
          onEditTask={onEditTask}
        />
      </div>

      {/* 5th Droppable Area: Uncategorized / Inbox Tray */}
      <QuadrantBox
        id="uncategorized"
        title="Uncategorized / Inbox Tray"
        subtitle="Tasks converted from Inbox or created without a priority quadrant — Drag into a quadrant above"
        icon={<Inbox className="w-4 h-4" />}
        accentColor="var(--action)"
        tasks={unassignedTasks}
        onEditTask={onEditTask}
        isTray
      />
    </div>
  )
}
