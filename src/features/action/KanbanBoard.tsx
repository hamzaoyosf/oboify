import React, { useMemo } from 'react'
import { FileText, Zap, CheckCircle2 } from 'lucide-react'
import { Task, EisenhowerQuadrant } from '@/data/ports/schemas'
import { KanbanColumn } from './KanbanColumn'

interface KanbanBoardProps {
  tasks: Task[]
  onEditTask?: (task: Task) => void
  selectedDate?: Date
}

/**
 * Task 3: The Smart Backlog (Draft Column Sorting)
 * Primary Sort (Quadrant): Q1 > Q2 > Q3 > Uncategorized > Q4
 */
function getQuadrantSortWeight(quadrant: EisenhowerQuadrant | undefined): number {
  if (quadrant === 'q1' || quadrant === 'do') return 1
  if (quadrant === 'q2' || quadrant === 'schedule') return 2
  if (quadrant === 'q3' || quadrant === 'delegate') return 3
  if (!quadrant) return 4 // Uncategorized / Inbox
  if (quadrant === 'q4' || quadrant === 'delete') return 5
  return 4
}

/**
 * Task 4: The Smart Backlog (Draft Column Sorting)
 * Applies strict sorting ONLY to tasks in the Draft column:
 * 1. Primary Sort (Quadrant): Q1 > Q2 > Q3 > Uncategorized > Q4.
 * 2. Secondary Sort:
 *    - For Uncategorized tasks: Sort descending by updatedAt so newly "demoted" tasks from Task 3 appear at the VERY TOP of the uncategorized cluster.
 *    - For all other quadrants: Sort chronologically by scheduledDate.
 */
function sortDraftTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // 1. Primary Sort: Quadrant (Q1 > Q2 > Q3 > Uncategorized > Q4)
    const weightA = getQuadrantSortWeight(a.quadrant)
    const weightB = getQuadrantSortWeight(b.quadrant)
    if (weightA !== weightB) {
      return weightA - weightB
    }

    // 2. Secondary Sort:
    // Case A: Uncategorized tasks -> Sort descending by updatedAt (newly demoted appear at top)
    if (!a.quadrant && !b.quadrant) {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
      if (timeB !== timeA) {
        return timeB - timeA
      }
      return (a.order || 0) - (b.order || 0)
    }

    // Case B: For all other quadrants -> Sort chronologically by scheduledDate
    const dateA = (a.scheduledDate || a.dueDate || '').trim().split('T')[0]
    const dateB = (b.scheduledDate || b.dueDate || '').trim().split('T')[0]

    if (dateA && dateB) {
      const cmp = dateA.localeCompare(dateB)
      if (cmp !== 0) return cmp
    } else if (dateA && !dateB) {
      return -1
    } else if (!dateA && dateB) {
      return 1
    }

    // Fallback: descending by updatedAt for stable newest-first sort
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
    if (timeB !== timeA) {
      return timeB - timeA
    }

    return (a.order || 0) - (b.order || 0)
  })
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onEditTask, selectedDate: _selectedDate }) => {
  const draftTasks = useMemo(() => {
    return sortDraftTasks(tasks.filter((t) => t.status === 'draft'))
  }, [tasks])

  const inProgressTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'in_progress')
  }, [tasks])

  const doneTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'done')
  }, [tasks])

  return (
    <div className="h-auto md:h-[calc(100vh-250px)] min-h-0 md:min-h-[480px] w-full flex flex-col overflow-visible md:overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 h-auto md:h-full pb-8 md:pb-0 overflow-visible md:overflow-hidden">
        <KanbanColumn
          id="draft"
          title="Draft"
          icon={<FileText className="w-4 h-4" />}
          accentColor="var(--text-muted)"
          tasks={draftTasks}
          onEditTask={onEditTask}
        />

        <KanbanColumn
          id="in_progress"
          title="In Progress"
          icon={<Zap className="w-4 h-4" />}
          accentColor="var(--action)"
          tasks={inProgressTasks}
          onEditTask={onEditTask}
        />

        <KanbanColumn
          id="done"
          title="Done"
          icon={<CheckCircle2 className="w-4 h-4" />}
          accentColor="var(--growth)"
          tasks={doneTasks}
          onEditTask={onEditTask}
        />
      </div>
    </div>
  )
}
