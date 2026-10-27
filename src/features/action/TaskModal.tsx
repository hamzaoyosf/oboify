import React, { useState, useEffect } from 'react'
import { X, CheckSquare, RefreshCw, Layers } from 'lucide-react'
import { addDays, format, parseISO } from 'date-fns'
import { Task, TaskStatus, GTDList, EisenhowerQuadrant, Priority } from '@/data/ports/schemas'
import { useCreateTask, useUpdateTask } from './useTasks'
import {
  getSmartInProgressMapping,
  getSmartDraftRevertMapping,
  getGTDForQuadrant,
} from '@/app/store/taskStore'
import { cn } from '@/lib/utils'

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  taskToEdit?: Task | null
}

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, taskToEdit }) => {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<TaskStatus>('draft')
  const [gtdList, setGtdList] = useState<GTDList>('next')
  const [quadrant, setQuadrant] = useState<EisenhowerQuadrant>(null)
  const [priority, setPriority] = useState<Priority>('medium')
  const [estimateMin, setEstimateMin] = useState<number>(15)
  const [scheduledDate, setScheduledDate] = useState<string>('')
  const [isRecall, setIsRecall] = useState<boolean>(false)

  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask()

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title)
      setNotes(taskToEdit.notes || '')
      setStatus(taskToEdit.status)
      setGtdList(taskToEdit.gtdList)
      setQuadrant(taskToEdit.quadrant)
      setPriority(taskToEdit.priority)
      setEstimateMin(taskToEdit.estimateMin || 15)
      setScheduledDate(taskToEdit.scheduledDate || taskToEdit.dueDate || '')
      const isRecallTask = Boolean(
        taskToEdit.recallRole ||
        taskToEdit.recallGroupId ||
        taskToEdit.srsRole ||
        taskToEdit.srsGroupId ||
        taskToEdit.isRecall
      )
      setIsRecall(isRecallTask)
    } else {
      setTitle('')
      setNotes('')
      setStatus('draft')
      setGtdList('next')
      setQuadrant(null)
      setPriority('medium')
      setEstimateMin(15)
      setScheduledDate('')
      setIsRecall(false)
    }
  }, [taskToEdit, isOpen])

  if (!isOpen) return null

  // Calculate recall review dates for live preview
  const baseDate = scheduledDate
    ? scheduledDate.includes('T')
      ? parseISO(scheduledDate)
      : new Date(scheduledDate + 'T00:00:00')
    : new Date()

  const date1Preview = format(addDays(baseDate, 1), 'MMM d, yyyy')
  const date2Preview = format(addDays(baseDate, 14), 'MMM d, yyyy')
  const date3Preview = format(addDays(baseDate, 60), 'MMM d, yyyy')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    // Task 1B: If a task is saved with Recall enabled, default the PARENT task's quadrant to 'q2'
    // rather than leaving it as null/uncategorized. Normal tasks remain unchanged.
    // If the user manually selected a quadrant (e.g. promoted to Q1), that is respected.
    let effectiveQuadrant: EisenhowerQuadrant = quadrant || null
    let effectiveGtdList: GTDList = gtdList

    // Task 2: In Progress Smart Trigger
    if (status === 'in_progress') {
      const mapping = getSmartInProgressMapping(effectiveQuadrant, effectiveGtdList)
      if (mapping.quadrant !== undefined) effectiveQuadrant = mapping.quadrant
      if (mapping.gtdList !== undefined) effectiveGtdList = mapping.gtdList
    }

    // Task 1: The Q3 / Waiting For Two-Way Bind
    if (effectiveGtdList === 'waiting' && !effectiveQuadrant) {
      effectiveQuadrant = 'q3'
    } else if (
      (effectiveQuadrant === 'q3' || effectiveQuadrant === 'delegate') &&
      (!effectiveGtdList || effectiveGtdList === 'next')
    ) {
      effectiveGtdList = 'waiting'
    }

    if (isRecall && !effectiveQuadrant) {
      effectiveQuadrant = 'q2'
    }

    // Task 3: Uncategorized Safe Demotion (Edge Case)
    let effectiveStatus: TaskStatus = status
    if (effectiveQuadrant === null && taskToEdit && taskToEdit.quadrant !== null) {
      effectiveStatus = 'draft'
      effectiveGtdList = 'next'
    } else if (!taskToEdit && effectiveGtdList === 'someday') {
      effectiveStatus = 'draft'
    }

    if (!taskToEdit && effectiveGtdList === 'someday' && !quadrant) {
      effectiveQuadrant = null
    }

    if (taskToEdit) {
      updateMutation.mutate({
        id: taskToEdit.id,
        patch: {
          title: title.trim(),
          notes: notes.trim(),
          status: effectiveStatus,
          gtdList: effectiveGtdList,
          quadrant: effectiveQuadrant,
          priority,
          estimateMin,
          scheduledDate: scheduledDate || null,
          dueDate: scheduledDate || null,
          isRecall,
          ...(effectiveQuadrant === null && taskToEdit.quadrant !== null && {
            updatedAt: new Date().toISOString(),
          }),
        },
      })
    } else {
      createMutation.mutate({
        title: title.trim(),
        notes: notes.trim(),
        status: effectiveStatus,
        gtdList: effectiveGtdList,
        quadrant: effectiveQuadrant,
        priority,
        estimateMin,
        dueDate: scheduledDate || null,
        scheduledDate: scheduledDate || null,
        context: ['@computer'],
        tags: isRecall ? ['recall-parent'] : [],
        projectId: null,
        areaId: null,
        waitingFor: null,
        subtasks: [],
        calendarEventId: null,
        order: 1000,
        completedAt: null,
        isRecall,
      })
    }

    onClose()
  }

  const normalizedQuadrant =
    quadrant === 'do' ? 'q1' : quadrant === 'schedule' ? 'q2' : quadrant === 'delegate' ? 'q3' : quadrant === 'delete' ? 'q4' : quadrant

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-lg card bg-surface border border-[rgba(255,255,255,0.12)] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        data-hub="action"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[rgba(255,255,255,0.06)] shrink-0">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-5 h-5 text-action" />
            <h2 className="text-base font-semibold text-text">
              {taskToEdit ? 'Edit Task' : 'Create Task'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {(taskToEdit?.recallGroupId || taskToEdit?.srsGroupId) ? (
              <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-action/10 border border-action/30 text-action text-xs font-mono">
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Recall Loop ({(taskToEdit.recallRole || taskToEdit.srsRole) === 'parent' ? 'Base Task' : 'Recall Card'})
                </span>
              </div>
            ) : (
              /* Recall Loop Toggle for New Tasks & Non-recall Tasks */
              <div className="p-3.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface-2/40 space-y-2">
                <label className="flex items-center space-x-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRecall}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setIsRecall(checked)
                      if (checked) {
                        if (!quadrant) setQuadrant('q2')
                      } else {
                        if (quadrant === 'q2') setQuadrant(null)
                      }
                    }}
                    className="w-4 h-4 rounded border-border-strong text-action focus:ring-action bg-surface cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-text flex items-center space-x-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-action" />
                      <span>Enable Recall Loop (Spaced Review)</span>
                    </span>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Defaults to Q2 (Schedule) and generates 3 spaced review tasks (+1d, +14d, +60d). Can be freely customized.
                    </p>
                  </div>
                </label>

                {/* Live Spaced Review Tasks Preview */}
                {isRecall && (
                  <div className="mt-2.5 pt-2.5 border-t border-[rgba(255,255,255,0.06)] space-y-1.5 animate-in fade-in duration-150">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-action font-semibold flex items-center space-x-1">
                      <Layers className="w-3 h-3" />
                      <span>Auto-generating 3 Review Tasks in Q2 (Schedule):</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px] font-mono">
                      <div className="p-2 rounded-lg bg-surface border border-[rgba(255,255,255,0.06)]">
                        <span className="text-action font-bold block text-[10px]">1st (+24h)</span>
                        <span className="text-text-muted truncate block text-[11px]">{date1Preview}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-surface border border-[rgba(255,255,255,0.06)]">
                        <span className="text-action font-bold block text-[10px]">2nd (+14d)</span>
                        <span className="text-text-muted truncate block text-[11px]">{date2Preview}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-surface border border-[rgba(255,255,255,0.06)]">
                        <span className="text-action font-bold block text-[10px]">3rd (+60d)</span>
                        <span className="text-text-muted truncate block text-[11px]">{date3Preview}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="title" className="block text-xs font-medium text-text-muted mb-1">Title</label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title..."
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-sm text-text focus:outline-none focus:border-action/60"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details..."
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-sm text-text focus:outline-none focus:border-action/60 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Status */}
              <div>
                <label className="block font-medium text-text-muted mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => {
                    const newStatus = e.target.value as TaskStatus
                    const oldStatus = status
                    setStatus(newStatus)
                    if (newStatus === 'in_progress') {
                      const mapping = getSmartInProgressMapping(quadrant, gtdList)
                      if (mapping.quadrant !== undefined) {
                        setQuadrant(mapping.quadrant)
                      }
                      if (mapping.gtdList !== undefined) {
                        setGtdList(mapping.gtdList)
                      }
                    } else if (newStatus === 'draft' && oldStatus === 'in_progress') {
                      const revertMapping = getSmartDraftRevertMapping(quadrant, gtdList, oldStatus)
                      if (revertMapping.gtdList !== undefined) {
                        setGtdList(revertMapping.gtdList)
                      }
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-text focus:outline-none focus:border-action/60"
                >
                  <option value="draft">Draft</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

              {/* GTD List */}
              <div>
                <label className="block font-medium text-text-muted mb-1">GTD List</label>
                <select
                  value={gtdList}
                  onChange={(e) => {
                    const nextGtd = e.target.value as GTDList
                    setGtdList(nextGtd)
                    // Task 1: Rule A: IF GTD is changed to 'waiting', auto-update quadrant to 'q3'
                    if (nextGtd === 'waiting') {
                      setQuadrant('q3')
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-text focus:outline-none focus:border-action/60"
                >
                  <option value="next">Next Action</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="waiting">Waiting For</option>
                  <option value="someday">Someday</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block font-medium text-text-muted mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-text focus:outline-none focus:border-action/60"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Quadrant */}
              <div>
                <label className="block font-medium text-text-muted mb-1">Quadrant</label>
                <select
                  value={normalizedQuadrant || ''}
                  onChange={(e) => {
                    const nextQ = (e.target.value as EisenhowerQuadrant) || null
                    setQuadrant(nextQ)
                    if (nextQ === null) {
                      // Task 3: Uncategorized Safe Demotion
                      setStatus('draft')
                      setGtdList('next')
                    } else {
                      // Task 1: Default Eisenhower -> GTD Auto-Mapping (Two-Way Bind)
                      // q1 -> 'next', q2 -> 'scheduled', q3 -> 'waiting', q4 -> 'someday'
                      const autoGtd = getGTDForQuadrant(nextQ)
                      if (autoGtd) {
                        setGtdList(autoGtd)
                      }
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-text focus:outline-none focus:border-action/60"
                >
                  <option value="">Unassigned (Inbox Tray)</option>
                  <option value="q1">Q1: Do</option>
                  <option value="q2">Q2: Schedule</option>
                  <option value="q3">Q3: Delegate</option>
                  <option value="q4">Q4: Eliminate</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Estimate (Minutes)
              </label>
              <input
                type="number"
                min={0}
                step={5}
                value={estimateMin}
                onChange={(e) => setEstimateMin(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-sm text-text focus:outline-none focus:border-action/60 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Scheduled Date / Due Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-sm text-text focus:outline-none focus:border-action/60 font-mono"
              />
              {(taskToEdit?.recallRole || taskToEdit?.srsRole) === 'parent' && (
                <p className="text-[11px] text-text-faint mt-1">
                  Updating this date will automatically reschedule linked recall cards (+1d, +14d, +60d).
                </p>
              )}
              {(taskToEdit?.recallRole || taskToEdit?.srsRole) === 'child' && (
                <p className="text-[11px] text-text-faint mt-1">
                  Cognitive anti-procrastination rules: delays ≤ 2 days apply Grace Period forward shift; delays &gt; 2 days trigger the Reset Penalty back to 1st Recall.
                </p>
              )}
            </div>
          </div>

          {/* Sticky Pinned Footer */}
          <div className="shrink-0 p-4 sm:p-5 border-t border-[rgba(255,255,255,0.06)] bg-surface-2/40 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-chip text-xs font-medium text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!title.trim()}
              className={cn(
                'px-4 py-2 rounded-chip text-xs font-semibold bg-action text-black hover:brightness-110 active:scale-95 transition-all shadow-sm',
                !title.trim() && 'opacity-50 cursor-not-allowed'
              )}
            >
              {taskToEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
