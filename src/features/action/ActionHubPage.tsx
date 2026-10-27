import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  pointerWithin,
  rectIntersection,
  closestCenter,
  CollisionDetection,
} from '@dnd-kit/core'
import { Zap, Kanban as KanbanIcon, Grid, Clock, Plus, Filter, CalendarCheck, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { Task, GTDList, TaskStatus, EisenhowerQuadrant, TimeBlock } from '@/data/ports/schemas'
import { toast } from 'sonner'
import { useTasks, useUpdateTask } from './useTasks'
import { useTimeBlocks, useCreateTimeBlock, useUpdateTimeBlock, useDeleteTimeBlock } from './useTimeBlocks'
import { KanbanBoard } from './KanbanBoard'
import { EisenhowerGrid } from './EisenhowerGrid'
import { TaskCard } from './TaskCard'
import { TaskModal } from './TaskModal'
import { WeeklyReviewWizard } from './components/WeeklyReviewWizard'
import { TimelineView } from './timeline/TimelineView'
import { useUIStore } from '@/app/store/uiStore'
import {
  useTaskStore,
  getSmartInProgressMapping,
  getSmartDraftRevertMapping,
  getGTDForQuadrant,
  getSmartTimelineDropMapping,
  getSmartTimelineUnscheduleMapping,
} from '@/app/store/taskStore'
import { cn } from '@/lib/utils'

type ActionViewMode = 'kanban' | 'eisenhower' | 'timeline'

export const ActionHubPage: React.FC = () => {
  const { data: allTasks = [], isLoading } = useTasks()
  const updateTaskMutation = useUpdateTask()
  const openWeeklyReview = useUIStore((s) => s.openWeeklyReview)

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const selectedYear = selectedDate.getFullYear()
  const selectedMonth = String(selectedDate.getMonth() + 1).padStart(2, '0')
  const selectedDay = String(selectedDate.getDate()).padStart(2, '0')
  const selectedDateStr = `${selectedYear}-${selectedMonth}-${selectedDay}`
  const { data: dayTimeBlocks = [] } = useTimeBlocks(selectedDateStr)
  const deleteTimeBlockMutation = useDeleteTimeBlock()
  const createTimeBlockMutation = useCreateTimeBlock()
  const updateTimeBlockMutation = useUpdateTimeBlock()

  const [searchParams, setSearchParams] = useSearchParams()
  const viewParam = searchParams.get('view') as ActionViewMode | null

  const [viewMode, setViewMode] = useState<ActionViewMode>(() => {
    if (viewParam === 'timeline' || viewParam === 'eisenhower' || viewParam === 'kanban') {
      return viewParam
    }
    return 'kanban'
  })

  // Synchronize viewMode whenever the URL 'view' param changes (e.g. from notification radar or deep links)
  useEffect(() => {
    if (viewParam === 'timeline' || viewParam === 'eisenhower' || viewParam === 'kanban') {
      if (viewParam !== viewMode) {
        setViewMode(viewParam)
      }
    }
  }, [viewParam, viewMode])

  const handleViewChange = (mode: ActionViewMode) => {
    setViewMode(mode)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('view', mode)
        return next
      },
      { replace: true }
    )
  }

  const [selectedGTD, setSelectedGTD] = useState<GTDList | 'all'>('all')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeBlock, setActiveBlock] = useState<TimeBlock | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)

    // Configure accessible drag sensors with mobile touch delay (250ms) and mouse distance constraints
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 15,
    },
  })
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10,
    },
  })
  const sensors = useSensors(mouseSensor, touchSensor)

  // Prioritize pointer collisions with graceful fallbacks so drops never bounce back
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      return pointerCollisions
    }
    const rectCollisions = rectIntersection(args)
    if (rectCollisions.length > 0) {
      return rectCollisions
    }
    return closestCenter(args)
  }

  // Smart Date Filter Logic for Kanban and Eisenhower (Task 1):
  // 1. Explicitly Unscheduled / Draft (so user can always see their Inbox/Drafts to drag them)
  // 2. OR scheduledDate matches selectedDate
  // 3. OR Overdue (scheduledDate < localTodayStr) AND status !== 'done' (carries over into Today)
  // Future recall cards are completely hidden unless user navigates to their specific future date!
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const isViewingToday = selectedDateStr === todayStr

  const dateFilteredTasks = allTasks.filter((task) => {
    // Strictly filter out permanently deleted tasks
    if (!task) return false
    if ((task as unknown as { isDeleted?: boolean }).isDeleted === true) return false
    if ((task as unknown as { deleted?: boolean }).deleted === true) return false

    const taskDate = (task.scheduledDate || task.dueDate || '').trim().split('T')[0]

    // 1. Explicitly Unscheduled / Draft (no scheduledDate and no dueDate)
    const isUnscheduled = !taskDate

    // 2. ScheduledDate exactly matches selectedDate
    const isExactDateMatch = taskDate === selectedDateStr

    // 3. Overdue tasks carry over into Today
    const isOverdue = Boolean(taskDate && taskDate < todayStr && task.status !== 'done')
    const carriesOverToToday = isViewingToday && isOverdue

    return isUnscheduled || isExactDateMatch || carriesOverToToday
  })

  // Filter tasks by GTD List if selected
  const filteredTasks = dateFilteredTasks.filter((task) => {
    if (selectedGTD === 'all') return true
    return task.gtdList === selectedGTD
  })

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current
    if (activeData?.type === 'TimeBlock') {
      setActiveBlock(activeData.block as TimeBlock)
      setActiveTask(null)
    } else if (activeData?.type === 'Task' || activeData?.task) {
      setActiveTask(activeData.task as Task)
      setActiveBlock(null)
    } else {
      const task = allTasks.find((t) => t.id === event.active.id)
      if (task) {
        setActiveTask(task)
        setActiveBlock(null)
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    console.log("DRAG END: ", { activeId: active.id, overId: over?.id })

    setActiveTask(null)
    setActiveBlock(null)

    if (!over) return

    try {
      const overId = String(over.id)
      const activeId = String(active.id)
      const activeData = active.data.current
      const activeType = activeData?.type

      // Intercept drops into Unscheduled Tasks Sidebar (or dragging TimeBlock out of timeline)
      const isSidebarTarget =
        overId === 'unscheduled-sidebar' ||
        overId === 'unscheduled' ||
        overId === 'sidebar' ||
        over.data?.current?.type === 'unscheduled-sidebar' ||
        allTasks.some((t) => t.id === overId)

      const isDraggingTimeBlock =
        activeType === 'TimeBlock' ||
        Boolean(activeData?.block) ||
        activeId.startsWith('blk_')

      const isTimelineDropToSidebar =
        (isDraggingTimeBlock && !overId.startsWith('slot-')) ||
        (isSidebarTarget && (isDraggingTimeBlock || viewMode === 'timeline'))

      if (isTimelineDropToSidebar) {
        let taskId: string | null = null
        let blockId: string | null = null

        if (activeData?.block) {
          const block = activeData.block as TimeBlock
          blockId = block.id
          taskId = block.taskId || null
        } else if (activeId.startsWith('blk_')) {
          blockId = activeId
          const block = dayTimeBlocks.find((b) => b.id === activeId)
          taskId = block?.taskId || null
        } else if (activeData?.task) {
          const task = activeData.task as Task
          taskId = task.id
        } else if (activeId.startsWith('tsk_') || activeId.startsWith('task-')) {
          taskId = activeId.replace('task-', '')
        } else {
          const found = allTasks.find((t) => t.id === activeId || `task-${t.id}` === activeId)
          if (found) taskId = found.id
        }

        if (taskId && !blockId) {
          const matchingBlock = dayTimeBlocks.find((b) => b.taskId === taskId)
          if (matchingBlock) {
            blockId = matchingBlock.id
          }
        }

        if (blockId && !taskId) {
          const matchingBlock = dayTimeBlocks.find((b) => b.id === blockId)
          if (matchingBlock?.taskId) {
            taskId = matchingBlock.taskId
          }
        }

        const targetTask = taskId
          ? allTasks.find((t) => t.id === taskId) || useTaskStore.getState().tasks.find((t) => t.id === taskId)
          : null

        if (targetTask?.status === 'done') {
          toast.info('Completed tasks cannot be unscheduled', {
            description: 'Completed tasks are preserved as historical time-logs.',
          })
          return
        }

        if (taskId || blockId) {
          // Strictly call unscheduleTask on store
          if (taskId) {
            useTaskStore.getState().unscheduleTask(taskId)
          }

          // Delete the timeblock from timeline grid
          if (blockId) {
            deleteTimeBlockMutation.mutate(blockId)
          } else if (taskId) {
            const target =
              allTasks.find((t) => t.id === taskId) ||
              useTaskStore.getState().tasks.find((t) => t.id === taskId)

            if (target) {
              const unscheduleMapping = getSmartTimelineUnscheduleMapping(
                target.previousQuadrant,
                target.previousGtd,
                target.quadrant,
                target.gtd || target.gtdList
              )
              updateTaskMutation.mutate({
                id: taskId,
                patch: {
                  ...unscheduleMapping,
                  gtd: unscheduleMapping.gtdList,
                },
              })
            }
          }

          toast.success('Task unscheduled', {
            description: 'Moved back to unscheduled tasks sidebar',
          })
          return
        }

        if (viewMode === 'timeline') {
          return
        }
      }

      // 1. Sidebar task drop onto Timeline 15-minute slot
      if (overId.startsWith('slot-') && (activeId.startsWith('tsk_') || activeId.startsWith('task-') || activeType === 'Task' || activeData?.task)) {
        const draggedTask =
          (activeData?.task as Task) ||
          allTasks.find((t) => t.id === active.id || `task-${t.id}` === active.id || t.id === activeId.replace('task-', '')) ||
          useTaskStore.getState().tasks.find((t: Task) => t.id === active.id || `task-${t.id}` === active.id || t.id === activeId.replace('task-', ''))
        if (!draggedTask) return

        const [slotH, slotM] = overId.replace('slot-', '').split(':').map(Number)
        const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), slotH, slotM, 0)
        const durationMin = draggedTask.estimateMin && draggedTask.estimateMin > 0 ? draggedTask.estimateMin : 45
        const endDate = new Date(startDate.getTime() + durationMin * 60000)

        console.log("MUTATION FIRED", startDate, endDate)

        const recallGroupId = draggedTask.recallGroupId || draggedTask.srsGroupId || null
        createTimeBlockMutation.mutate({
          title: draggedTask.title,
          category: 'deep_work',
          color: 'cyan',
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          taskId: draggedTask.id,
          recallGroupId,
          srsGroupId: recallGroupId,
          source: 'OBOiFY',
          gcal: null,
        })

        const formattedStartTime = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`
        const year = selectedDate.getFullYear()
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
        const day = String(selectedDate.getDate()).padStart(2, '0')
        const scheduledDateStr = `${year}-${month}-${day}`

        // Task 2: Schedule Action (Save Memory)
        // BEFORE mutating the task to Q2 (if it was uncategorized), save exact current state to memory:
        // previousQuadrant: task.quadrant || 'uncategorized'
        // previousGtd: task.gtd || 'next_action'
        const previousQuadrant = draggedTask.quadrant || 'uncategorized'
        const previousGtd = draggedTask.gtd || draggedTask.gtdList || 'next_action'

        useTaskStore.getState().scheduleTask(draggedTask.id, {
          scheduledDate: scheduledDateStr,
          dueDate: scheduledDateStr,
          startTime: formattedStartTime,
        })

        const dropMapping = getSmartTimelineDropMapping(
          draggedTask.quadrant,
          draggedTask.gtdList
        )

        updateTaskMutation.mutate({
          id: draggedTask.id,
          patch: {
            quadrant: dropMapping.quadrant,
            gtdList: dropMapping.gtdList,
            gtd: dropMapping.gtdList,
            previousQuadrant,
            previousGtd,
            scheduledDate: scheduledDateStr,
            dueDate: scheduledDateStr,
            startTime: formattedStartTime,
          },
        })
        return
      }

      // 2. Moving an existing TimeBlock on Timeline (Timeline to Timeline)
      if (overId.startsWith('slot-') && (activeId.startsWith('blk_') || activeType === 'TimeBlock' || activeData?.block)) {
        const block = (activeData?.block as TimeBlock)
        if (!block) return

        const [slotH, slotM] = overId.replace('slot-', '').split(':').map(Number)
        const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), slotH, slotM, 0)

        const origStart = new Date(block.start)
        const origEnd = new Date(block.end)
        const durationMs =
          !isNaN(origStart.getTime()) && !isNaN(origEnd.getTime())
            ? Math.max(15 * 60 * 1000, origEnd.getTime() - origStart.getTime())
            : 45 * 60 * 1000

        const endDate = new Date(startDate.getTime() + durationMs)

        console.log("MUTATION FIRED", startDate, endDate)

        updateTimeBlockMutation.mutate({
          id: block.id,
          patch: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
        })

        if (block.taskId) {
          const formattedStartTime = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`
          const year = selectedDate.getFullYear()
          const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
          const day = String(selectedDate.getDate()).padStart(2, '0')
          const scheduledDateStr = `${year}-${month}-${day}`

          updateTaskMutation.mutate({
            id: block.taskId,
            patch: {
              startTime: formattedStartTime,
              scheduledDate: scheduledDateStr,
              dueDate: scheduledDateStr,
            },
          })
        }
        return
      }

      // 2. Kanban Board Drops
      if (viewMode === 'kanban') {
        const activeId = String(active.id)
        const currentTask = allTasks.find((t) => t.id === activeId || `task-${t.id}` === activeId)
        if (!currentTask) return

        const validColumns: TaskStatus[] = ['draft', 'in_progress', 'done']
        let targetStatus: TaskStatus | null = null

        if (validColumns.includes(overId as TaskStatus)) {
          targetStatus = overId as TaskStatus
        } else {
          const overTask = allTasks.find((t) => t.id === overId)
          if (overTask) {
            targetStatus = overTask.status
          }
        }

        if (targetStatus && currentTask.status !== targetStatus) {
          const patch: Partial<Task> = {
            status: targetStatus,
            completedAt: targetStatus === 'done' ? new Date().toISOString() : null,
          }

          // Task 2: The "In Progress" Smart Trigger (Kanban Drag)
          // - IF q3 (Delegate): DO NOTHING to quadrant or GTD. (It stays Q3 + Waiting For).
          // - IF q2 (Schedule): Keep quadrant q2, BUT temporarily change GTD to next_action ('next').
          // - IF q4 or uncategorized: Force quadrant to q1 AND GTD to next_action ('next').
          if (targetStatus === 'in_progress') {
            const mapping = getSmartInProgressMapping(currentTask.quadrant, currentTask.gtdList)
            if (mapping.quadrant !== undefined) {
              patch.quadrant = mapping.quadrant
            }
            if (mapping.gtdList !== undefined) {
              patch.gtdList = mapping.gtdList
            }
          } else if (targetStatus === 'draft' && currentTask.status === 'in_progress') {
            // Task 3: The "Draft" Revert Memory
            // IF the task is in q2 AND its GTD is next_action ('next'): Revert its GTD back to 'scheduled'.
            const revertMapping = getSmartDraftRevertMapping(currentTask.quadrant, currentTask.gtdList, currentTask.status)
            if (revertMapping.gtdList !== undefined) {
              patch.gtdList = revertMapping.gtdList
            }
          }

          updateTaskMutation.mutate({
            id: currentTask.id,
            patch,
          })
        }
        return
      }

      // 3. Eisenhower Matrix Drops
      if (viewMode === 'eisenhower') {
        const activeId = String(active.id)
        const currentTask = allTasks.find((t) => t.id === activeId || `task-${t.id}` === activeId)
        if (!currentTask) return

        let targetQuadrant: EisenhowerQuadrant = null
        let isValidDrop = false

        if (overId === 'unassigned' || overId === 'uncategorized') {
          targetQuadrant = null
          isValidDrop = true
        } else if (['do', 'q1'].includes(overId)) {
          targetQuadrant = 'q1'
          isValidDrop = true
        } else if (['schedule', 'q2'].includes(overId)) {
          targetQuadrant = 'q2'
          isValidDrop = true
        } else if (['delegate', 'q3'].includes(overId)) {
          targetQuadrant = 'q3'
          isValidDrop = true
        } else if (['delete', 'q4'].includes(overId)) {
          targetQuadrant = 'q4'
          isValidDrop = true
        } else {
          const overTask = allTasks.find((t) => t.id === overId)
          if (overTask) {
            targetQuadrant = overTask.quadrant
            isValidDrop = true
          }
        }

        if (
          isValidDrop &&
          (currentTask.quadrant !== targetQuadrant ||
            (targetQuadrant === null && (currentTask.status !== 'draft' || currentTask.gtdList !== 'next')))
        ) {
          const patch: Partial<Task> = {
            quadrant: targetQuadrant,
          }
          if (targetQuadrant === null) {
            // Task 3: Uncategorized Safe Demotion (Edge Case)
            // When a task is manually dropped into the uncategorized tray in the Eisenhower Matrix:
            // - Auto-change status to 'draft' (removing it from active execution)
            // - Auto-change gtd to 'next_action' ('next')
            patch.status = 'draft'
            patch.gtdList = 'next'
            patch.updatedAt = new Date().toISOString()
          } else {
            // Task 1: Default Eisenhower -> GTD Auto-Mapping (Two-Way Bind)
            // q1 -> 'next', q2 -> 'scheduled', q3 -> 'waiting', q4 -> 'someday'
            const autoGtd = getGTDForQuadrant(targetQuadrant)
            if (autoGtd) {
              patch.gtdList = autoGtd
            }
          }
          updateTaskMutation.mutate({
            id: currentTask.id,
            patch,
          })
        }
        return
      }
    } catch (err) {
      console.error("Error in onDragEnd:", err)
    }
  }

  const handleEditTask = (task: Task) => {
    setTaskToEdit(task)
    setIsModalOpen(true)
  }

  const handleNewTask = () => {
    setTaskToEdit(null)
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-3.5 sm:space-y-4 max-w-7xl mx-auto py-2 w-full max-w-full overflow-x-hidden flex flex-col">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-surface-2 text-emerald-400 border border-border">
              <Zap className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-text">Action Hub</h1>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Execution engine. Organize in Kanban, prioritize in Eisenhower, and block time on the Timeline.
          </p>
        </div>

        {/* View Toggle & Action Controls (flex-wrap to prevent viewport blowout) */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 max-w-full">
          {/* View Mode Toggle: 3 Modes */}
          <div className="flex items-center p-1 bg-surface-2 rounded-xl border border-border shrink-0">
            <button
              type="button"
              onClick={() => handleViewChange('kanban')}
              className={cn(
                'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                viewMode === 'kanban'
                  ? 'bg-surface text-emerald-400 shadow-sm'
                  : 'text-text-muted hover:text-text'
              )}
            >
              <KanbanIcon className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>

            <button
              type="button"
              onClick={() => handleViewChange('eisenhower')}
              className={cn(
                'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                viewMode === 'eisenhower'
                  ? 'bg-surface text-emerald-400 shadow-sm'
                  : 'text-text-muted hover:text-text'
              )}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Eisenhower</span>
            </button>

            <button
              type="button"
              onClick={() => handleViewChange('timeline')}
              className={cn(
                'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                viewMode === 'timeline'
                  ? 'bg-surface text-emerald-400 shadow-sm'
                  : 'text-text-muted hover:text-text'
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
          </div>

          {/* Weekly Review Launcher */}
          <button
            type="button"
            onClick={openWeeklyReview}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-chip font-medium text-xs bg-surface-2 border border-border text-text-muted hover:text-emerald-400 hover:border-emerald-500/40 transition-all active:scale-95 shadow-sm shrink-0"
            title="Launch GTD Weekly Review Wizard"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Weekly Review</span>
          </button>

          {/* New Task Button */}
          <button
            type="button"
            onClick={handleNewTask}
            className={cn(
              'flex items-center space-x-1.5 px-3.5 py-2 rounded-chip font-semibold text-xs shrink-0',
              'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 transition-all shadow-md'
            )}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Merged Control Toolbar: GTD Filters (Left) & Date Navigation (Right) */}
      {viewMode !== 'timeline' && (
        <div className="flex flex-row items-center justify-between w-full gap-2.5 mb-4">
          {/* Left: GTD Filter Buttons */}
          <div className="flex items-center space-x-1.5 overflow-x-auto whitespace-nowrap scrollbar-hide hide-scrollbar py-0.5 text-xs">
            <span className="flex items-center space-x-1 text-text-faint font-medium pl-1 pr-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              <span>GTD:</span>
            </span>

            {[
              { id: 'all', label: 'All Tasks' },
              { id: 'next', label: 'Next Action' },
              { id: 'scheduled', label: 'Scheduled' },
              { id: 'waiting', label: 'Waiting For' },
              { id: 'someday', label: 'Someday' },
            ].map((filter) => {
              const isSelected = selectedGTD === filter.id
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSelectedGTD(filter.id as GTDList | 'all')}
                  className={cn(
                    'px-2.5 py-1.5 rounded-chip font-medium whitespace-nowrap transition-colors border shrink-0',
                    isSelected
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-sm'
                      : 'bg-surface-2 text-text-muted border-border hover:text-text hover:bg-surface'
                  )}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>

          {/* Right: Date Navigation */}
          <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-surface/50 border border-[rgba(255,255,255,0.06)] shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => {
                const prev = new Date(selectedDate)
                prev.setDate(prev.getDate() - 1)
                setSelectedDate(prev)
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-surface-2 text-xs font-medium text-text-muted hover:text-text hover:bg-surface transition-colors active:scale-95"
              title="Previous Day"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            <div className="flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-action shrink-0" />
              <button
                type="button"
                onClick={() => setSelectedDate(new Date())}
                className={cn(
                  'text-xs font-semibold tracking-wide transition-all px-2.5 py-1.5 rounded-lg border whitespace-nowrap',
                  isViewingToday
                    ? 'bg-action/15 border-action/40 text-action'
                    : 'bg-surface-2 border-[rgba(255,255,255,0.08)] text-text hover:text-action'
                )}
                title={isViewingToday ? 'Currently on Today' : 'Jump to Today'}
              >
                {isViewingToday
                  ? `Today (${selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })})`
                  : selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = new Date(selectedDate)
                next.setDate(next.getDate() + 1)
                setSelectedDate(next)
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-surface-2 text-xs font-medium text-text-muted hover:text-text hover:bg-surface transition-colors active:scale-95"
              title="Next Day"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Unified DndContext for Kanban, Eisenhower, and Timeline */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="card p-6 animate-pulse bg-surface-2/40 h-96" />
            ))}
          </div>
        ) : viewMode === 'timeline' ? (
          <TimelineView
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            isDraggingActive={Boolean(activeTask || activeBlock)}
            onEditTask={handleEditTask}
          />
        ) : viewMode === 'kanban' ? (
          <KanbanBoard tasks={filteredTasks} onEditTask={handleEditTask} selectedDate={selectedDate} />
        ) : (
          <EisenhowerGrid tasks={filteredTasks} onEditTask={handleEditTask} selectedDate={selectedDate} />
        )}

        {/* Global Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <TaskCard task={activeTask} isOverlay />
          ) : activeBlock ? (
            <div className="card p-3 bg-surface-2 border border-action/60 shadow-2xl scale-[1.02] rotate-1 ring-1 ring-action/50 text-xs w-64 pointer-events-none">
              <p className="font-semibold text-text truncate">{activeBlock.title}</p>
              <p className="text-[10px] font-mono text-action mt-1 flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Move time block</span>
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Creation / Edit Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        taskToEdit={taskToEdit}
      />

      {/* GTD Weekly Review Wizard */}
      <WeeklyReviewWizard />
    </div>
  )
}
