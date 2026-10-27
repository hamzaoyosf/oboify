import { create } from 'zustand'
import { addDays, format, parseISO } from 'date-fns'
import { Task, EisenhowerQuadrant, GTDList, TaskStatus } from '@/data/ports/schemas'
import { repos } from '@/data'

interface TaskState {
  tasks: Task[]
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  scheduleTask: (id: string, scheduleData?: Partial<Task>) => void
  unscheduleTask: (id: string) => void
  deleteTask: (id: string) => void
  cascadeDeleteRecall: (recallGroupId: string) => void
  cascadeRescheduleRecall: (parentId: string, newScheduledDate: string) => void
  cascadeDeleteSRS: (srsGroupId: string) => void
  cascadeRescheduleSRS: (parentId: string, newScheduledDate: string) => void
}

/**
 * Calculates a rescheduled date preserving intervals (+1d, +14d, +60d or deltaDays)
 * using robust calendar date math that handles month/year rollovers accurately.
 */
export function calculateRecallChildDate(
  baseDateStr: string,
  intervalDays: number
): string {
  try {
    const dateOnly = baseDateStr.trim().split('T')[0]
    const [yearStr, monthStr, dayStr] = dateOnly.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10) - 1
    const day = parseInt(dayStr, 10)
    const base = new Date(year, month, day)
    const calculated = addDays(base, intervalDays)
    return format(calculated, 'yyyy-MM-dd')
  } catch {
    try {
      const parsed = parseISO(baseDateStr)
      return format(addDays(parsed, intervalDays), 'yyyy-MM-dd')
    } catch {
      return baseDateStr
    }
  }
}

// Backwards-compatible alias
export const calculateSRSChildDate = calculateRecallChildDate

/**
 * Computes difference in calendar days: d1 - d2.
 */
export function getCalendarDaysDiff(d1Str: string, d2Str: string): number {
  try {
    const clean1 = d1Str.trim().split('T')[0]
    const clean2 = d2Str.trim().split('T')[0]
    const [y1, m1, day1] = clean1.split('-').map(Number)
    const [y2, m2, day2] = clean2.split('-').map(Number)
    const utc1 = Date.UTC(y1, m1 - 1, day1)
    const utc2 = Date.UTC(y2, m2 - 1, day2)
    return Math.round((utc1 - utc2) / (1000 * 60 * 60 * 24))
  } catch {
    return 0
  }
}

/**
 * Strips review/recall prefixes to extract the base underlying task title.
 */
export function extractBaseRecallTitle(title: string): string {
  return title.replace(/^(1st|2nd|3rd)\s+(Recall|Review)[^:]*:\s*/i, '').trim()
}

/**
 * Returns the sequence step (1, 2, or 3) of a Recall card.
 */
export function getRecallCardStep(task: Task): 1 | 2 | 3 {
  const title = (task.title || '').toLowerCase()
  const tags = task.tags || []

  if (
    title.includes('3rd recall') ||
    title.includes('3rd review') ||
    title.includes('3rd') ||
    title.includes('2 month') ||
    title.includes('60d') ||
    tags.includes('2m') ||
    tags.includes('60d')
  ) {
    return 3
  }

  if (
    title.includes('2nd recall') ||
    title.includes('2nd review') ||
    title.includes('2nd') ||
    title.includes('2 week') ||
    title.includes('14d') ||
    tags.includes('2w') ||
    tags.includes('14d')
  ) {
    return 2
  }

  return 1
}

/**
 * Detects the review interval (1, 14, 60 days) from a child task:
 * - "1st Recall" child -> +1 day
 * - "2nd Recall" child -> +14 days
 * - "3rd Recall" child -> +60 days
 */
export function getRecallIntervalDays(childTask: Task): number {
  const step = getRecallCardStep(childTask)
  if (step === 3) return 60
  if (step === 2) return 14
  return 1
}

// Backwards-compatible alias
export const getSRSIntervalDays = getRecallIntervalDays

/**
 * Task 1: Default Eisenhower -> GTD Auto-Mapping
 * - q1 -> 'next' (next_action)
 * - q2 -> 'scheduled'
 * - q3 -> 'waiting' (waiting_for)
 * - q4 -> 'someday'
 * - uncategorized / null -> null (leave unchanged as inbox)
 */
export function getGTDForQuadrant(quadrant: EisenhowerQuadrant | undefined): GTDList | null {
  if (quadrant === 'q1' || quadrant === 'do') return 'next'
  if (quadrant === 'q2' || quadrant === 'schedule') return 'scheduled'
  if (quadrant === 'q3' || quadrant === 'delegate') return 'waiting'
  if (quadrant === 'q4' || quadrant === 'delete') return 'someday'
  return null
}

export interface SmartKanbanMoveResult {
  quadrant?: EisenhowerQuadrant
  gtdList?: GTDList
}

/**
 * Task 2: The "In Progress" Smart Trigger (Kanban Drag)
 * - IF q3 (Delegate): DO NOTHING to quadrant or GTD. (It stays Q3 + Waiting For).
 * - IF q2 (Schedule): Keep quadrant q2, BUT temporarily change GTD to next_action ('next').
 * - IF q4 or uncategorized: Force quadrant to q1 AND GTD to next_action ('next').
 * - IF already q1: Keep q1 AND GTD 'next'.
 */
export function getSmartInProgressMapping(
  currentQuadrant: EisenhowerQuadrant | undefined,
  _currentGtdList?: GTDList | undefined
): SmartKanbanMoveResult {
  // Case 1: Q3 (Delegate) -> DO NOTHING to quadrant or GTD (immune)
  if (currentQuadrant === 'q3' || currentQuadrant === 'delegate') {
    return {}
  }

  // Case 2: Q2 (Schedule) -> Keep quadrant q2, BUT change GTD to 'next' (next_action)
  if (currentQuadrant === 'q2' || currentQuadrant === 'schedule') {
    return {
      quadrant: currentQuadrant,
      gtdList: 'next',
    }
  }

  // Case 3: Q4 (Eliminate) or Uncategorized (null) -> Force quadrant to 'q1' AND GTD to 'next'
  if (!currentQuadrant || currentQuadrant === 'q4' || currentQuadrant === 'delete') {
    return {
      quadrant: 'q1',
      gtdList: 'next',
    }
  }

  // Case 4: Already Q1 -> Keep Q1 and GTD 'next'
  return {
    quadrant: 'q1',
    gtdList: 'next',
  }
}

/**
 * Legacy compatibility helper for getSmartInProgressQuadrant
 */
export function getSmartInProgressQuadrant(
  currentQuadrant: EisenhowerQuadrant | undefined
): EisenhowerQuadrant {
  const res = getSmartInProgressMapping(currentQuadrant)
  return res.quadrant !== undefined ? res.quadrant : (currentQuadrant || 'q1')
}

/**
 * Task 3: The "Draft" Revert Memory (Edge Case Handling)
 * When a task is moved from 'in_progress' BACK to 'draft':
 * - IF the task is in q2 AND its GTD is next_action ('next'): Revert its GTD back to 'scheduled'.
 */
export function getSmartDraftRevertMapping(
  currentQuadrant: EisenhowerQuadrant | undefined,
  currentGtdList: GTDList | undefined,
  previousStatus?: TaskStatus | undefined
): SmartKanbanMoveResult {
  if (previousStatus === 'in_progress' || !previousStatus) {
    const isQ2 = currentQuadrant === 'q2' || currentQuadrant === 'schedule'
    const isNext = currentGtdList === 'next' || (currentGtdList as unknown as string) === 'next_action'
    if (isQ2 && isNext) {
      return {
        gtdList: 'scheduled',
      }
    }
  }
  return {}
}

export interface SmartDemotionResult {
  status: TaskStatus
  gtdList: GTDList
  quadrant: null
  updatedAt: string
}

/**
 * Task 3: Uncategorized Safe Demotion (Edge Case)
 * When a task is manually dropped or demoted into the uncategorized tray in the Eisenhower Matrix:
 * - Auto-change status to 'draft' (removing it from active execution).
 * - Auto-change gtd to 'next' (safe default, prevents UI crash since null is invalid).
 */
export function getSmartDemotionMapping(): SmartDemotionResult {
  return {
    status: 'draft',
    gtdList: 'next',
    quadrant: null,
    updatedAt: new Date().toISOString(),
  }
}

export interface TimelineSchedulingResult {
  quadrant: EisenhowerQuadrant
  gtdList: GTDList
  previousQuadrant: string | null
  previousGtd: string | null
}

/**
 * Task 2: Timeline Drop Logic (Scheduling)
 * When a task is dropped onto the Timeline (scheduling it):
 * - Snapshot: Save current quadrant and gtd to previousQuadrant and previousGtd.
 *   previousQuadrant: task.quadrant || 'uncategorized'
 *   previousGtd: task.gtd || 'next_action'
 * - Rules:
 *   - IF uncategorized (null / 'uncategorized'), q4, or someday: Auto-change to q2 and scheduled.
 *   - IF q2: Keep q2, ensure GTD is scheduled.
 *   - IF q1 or q3: DO NOT mutate quadrant or GTD (keep priority/delegation tags, only date/time is updated).
 */
export function getSmartTimelineDropMapping(
  currentQuadrant: EisenhowerQuadrant | string | undefined,
  currentGtdList: GTDList | string | undefined
): TimelineSchedulingResult {
  const previousQuadrant = currentQuadrant || 'uncategorized'
  const previousGtd = (currentGtdList as string) || 'next_action'

  // Rule 3: IF q1 or q3: DO NOT mutate quadrant or GTD
  if (
    currentQuadrant === 'q1' ||
    currentQuadrant === 'do' ||
    currentQuadrant === 'q3' ||
    currentQuadrant === 'delegate'
  ) {
    const defaultGtd = currentQuadrant === 'q3' || currentQuadrant === 'delegate' ? 'waiting' : 'next'
    return {
      quadrant: currentQuadrant as EisenhowerQuadrant,
      gtdList: (currentGtdList as GTDList) || defaultGtd,
      previousQuadrant,
      previousGtd,
    }
  }

  // Rule 2: IF q2: Keep q2, ensure GTD is scheduled
  if (currentQuadrant === 'q2' || currentQuadrant === 'schedule') {
    return {
      quadrant: 'q2',
      gtdList: 'scheduled',
      previousQuadrant,
      previousGtd,
    }
  }

  // Rule 1: IF uncategorized, q4, or someday: Auto-change to q2 and scheduled
  return {
    quadrant: 'q2',
    gtdList: 'scheduled',
    previousQuadrant,
    previousGtd,
  }
}

export interface TimelineUnscheduleResult {
  quadrant: EisenhowerQuadrant
  gtdList: GTDList
  scheduledDate: null
  dueDate: null
  startTime: null
  previousQuadrant: null
  previousGtd: null
}

/**
 * Task 3: Timeline Removal Logic (Un-scheduling / Strict Restoration)
 * - REMOVE ANY hardcoded fallback to 'uncategorized' in this function.
 * - The mutation MUST strictly be:
 *   quadrant: task.previousQuadrant !== undefined ? task.previousQuadrant : task.quadrant
 *   gtd: task.previousGtd !== undefined ? task.previousGtd : task.gtd
 * - Clear previousQuadrant and previousGtd after restoring.
 */
export function getSmartTimelineUnscheduleMapping(
  previousQuadrant?: EisenhowerQuadrant | string | null,
  previousGtd?: string | null,
  currentQuadrant?: EisenhowerQuadrant | string | null,
  currentGtd?: string | null
): TimelineUnscheduleResult {
  // Strictly restore quadrant:
  // If previousQuadrant is defined and non-empty, restore it; otherwise preserve current quadrant!
  const hasPreviousQuadrant =
    typeof previousQuadrant === 'string' && previousQuadrant.trim().length > 0
  const restoredQuadrantRaw = hasPreviousQuadrant ? previousQuadrant : currentQuadrant

  let restoredQuadrant: EisenhowerQuadrant = null
  if (restoredQuadrantRaw === 'q1' || restoredQuadrantRaw === 'do') {
    restoredQuadrant = 'q1'
  } else if (restoredQuadrantRaw === 'q2' || restoredQuadrantRaw === 'schedule') {
    restoredQuadrant = 'q2'
  } else if (restoredQuadrantRaw === 'q3' || restoredQuadrantRaw === 'delegate') {
    restoredQuadrant = 'q3'
  } else if (restoredQuadrantRaw === 'q4' || restoredQuadrantRaw === 'delete') {
    restoredQuadrant = 'q4'
  } else if (restoredQuadrantRaw === 'uncategorized') {
    restoredQuadrant = 'uncategorized' as unknown as EisenhowerQuadrant
  } else {
    restoredQuadrant = restoredQuadrantRaw as EisenhowerQuadrant
  }

  // Strictly restore GTD:
  const hasPreviousGtd =
    typeof previousGtd === 'string' && previousGtd.trim().length > 0
  const restoredGtdRaw = hasPreviousGtd ? previousGtd : currentGtd

  let restoredGtd: GTDList = 'next'
  if (restoredGtdRaw === 'waiting' || restoredGtdRaw === 'waiting_for') {
    restoredGtd = 'waiting'
  } else if (restoredGtdRaw === 'scheduled') {
    restoredGtd = 'scheduled'
  } else if (restoredGtdRaw === 'someday') {
    restoredGtd = 'someday'
  } else if (restoredGtdRaw === 'next' || restoredGtdRaw === 'next_action') {
    restoredGtd = 'next'
  } else if (restoredQuadrant === 'q2') {
    restoredGtd = 'scheduled'
  } else if (restoredQuadrant === 'q3') {
    restoredGtd = 'waiting'
  } else if (restoredQuadrant === 'q4') {
    restoredGtd = 'someday'
  }

  return {
    quadrant: restoredQuadrant,
    gtdList: restoredGtd,
    scheduledDate: null,
    dueDate: null,
    startTime: null,
    previousQuadrant: null,
    previousGtd: null,
  }
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) =>
    set((state) => {
      const isRecall = Boolean(
        task.recallGroupId ||
        task.srsGroupId ||
        task.recallRole ||
        task.srsRole ||
        (task as unknown as { isRecall?: boolean }).isRecall
      )
      const adjustedTask = { ...task }
      // Automate Parent Recall Card Categorization: If task has Recall enabled, route to Q2 (Schedule)
      if (isRecall && !adjustedTask.quadrant) {
        adjustedTask.quadrant = 'q2'
      }

      // Task 1: Default Eisenhower -> GTD Auto-Mapping on creation if quadrant is provided
      if (adjustedTask.quadrant && !task.gtdList) {
        const autoGtd = getGTDForQuadrant(adjustedTask.quadrant)
        if (autoGtd) {
          adjustedTask.gtdList = autoGtd
        }
      }

      // Task 1: Q3 <-> Waiting For Two-Way Bind
      const taskGtd = adjustedTask.gtdList as unknown as string
      if (taskGtd === 'waiting' || taskGtd === 'waiting_for') {
        adjustedTask.gtdList = 'waiting'
        if (!adjustedTask.quadrant) {
          adjustedTask.quadrant = 'q3'
        }
      } else if (
        (adjustedTask.quadrant === 'q3' || adjustedTask.quadrant === 'delegate') &&
        (!adjustedTask.gtdList || adjustedTask.gtdList === 'next')
      ) {
        adjustedTask.gtdList = 'waiting'
      }

      // Task 2: If created as gtd: 'someday', default to uncategorized (null) and draft (do not force to q4)
      if (adjustedTask.gtdList === 'someday' && !task.quadrant) {
        adjustedTask.quadrant = null
        if (!task.status) {
          adjustedTask.status = 'draft'
        }
      }

      return {
        tasks: [adjustedTask, ...state.tasks],
      }
    }),

  /**
   * Updates a task with integrated anti-procrastination cognitive science rules:
   * 1. Parent Date Update: Cascades and recalculates all child review intervals (+1d, +14d, +60d).
   * 2. Child Date Update & Completion:
   *    - Rule A (Forward Cascade): When completing a task (recall success) OR rescheduling within Grace Period (deltaDays <= 2),
   *      applies Forward Cascading Shift to this card and all subsequent child cards to preserve true spaced repetition intervals.
   *    - Rule B (Reset Penalty): When rescheduling with delay > 2 days (procrastination), resets current card back to "1st Recall (24h)",
   *      preserves custom user tags while removing stale interval tags, purges subsequent child cards, and regenerates new +14d and +60d cards.
   */
  updateTask: (id, patch) => {
    const currentTasks = get().tasks
    const target = currentTasks.find((t) => t.id === id)
    if (!target) return

    // Task 2: The "In Progress" Smart Trigger (Kanban Drag)
    // - IF q3 (Delegate): DO NOTHING to quadrant or GTD (stays Q3 + Waiting For)
    // - IF q2 (Schedule): Keep quadrant q2, BUT change GTD to next_action ('next')
    // - IF q4 or uncategorized: Force quadrant to q1 AND GTD to next_action ('next')
    // Task 3: The "Draft" Revert Memory
    // - Moving from in_progress BACK to draft: IF q2 and GTD is next_action ('next') -> Revert GTD back to 'scheduled'
    const effectivePatch: Partial<Task> = { ...patch }
    if (effectivePatch.status === 'done' && target.status !== 'done' && effectivePatch.previousStatus === undefined) {
      effectivePatch.previousStatus = target.status
    } else if (effectivePatch.status && effectivePatch.status !== 'done' && target.status === 'done' && effectivePatch.previousStatus === undefined) {
      effectivePatch.previousStatus = null
    }

    if (effectivePatch.status === 'in_progress' && target.status !== 'in_progress') {
      const mapping = getSmartInProgressMapping(
        effectivePatch.quadrant !== undefined ? effectivePatch.quadrant : target.quadrant,
        effectivePatch.gtdList !== undefined ? effectivePatch.gtdList : target.gtdList
      )
      if (mapping.quadrant !== undefined && effectivePatch.quadrant === undefined) {
        effectivePatch.quadrant = mapping.quadrant
      }
      if (mapping.gtdList !== undefined && effectivePatch.gtdList === undefined) {
        effectivePatch.gtdList = mapping.gtdList
      }
    } else if (effectivePatch.status === 'draft' && target.status === 'in_progress') {
      const revertMapping = getSmartDraftRevertMapping(
        effectivePatch.quadrant !== undefined ? effectivePatch.quadrant : target.quadrant,
        effectivePatch.gtdList !== undefined ? effectivePatch.gtdList : target.gtdList,
        target.status
      )
      if (revertMapping.gtdList !== undefined && effectivePatch.gtdList === undefined) {
        effectivePatch.gtdList = revertMapping.gtdList
      }
    }

    // Task 3: Uncategorized Safe Demotion (Edge Case)
    // When a task is manually dropped or demoted into uncategorized (quadrant: null):
    // - Auto-change status to 'draft' (removing it from active execution)
    // - Auto-change gtd to 'next' (safe default, prevents UI crash since null is invalid)
    // - Refresh updatedAt so it appears at the very top of the uncategorized cluster in Draft
    if (effectivePatch.quadrant === null && target.quadrant !== null) {
      if (effectivePatch.status === undefined) {
        effectivePatch.status = 'draft'
      }
      if (effectivePatch.gtdList === undefined) {
        effectivePatch.gtdList = 'next'
      }
      if (!effectivePatch.updatedAt) {
        effectivePatch.updatedAt = new Date().toISOString()
      }
    }

    // Task 1: Default Eisenhower -> GTD Auto-Mapping (when quadrant is manually changed)
    // q1 -> 'next', q2 -> 'scheduled', q3 -> 'waiting', q4 -> 'someday', uncategorized -> safe default 'next'
    if (
      effectivePatch.quadrant !== undefined &&
      effectivePatch.gtdList === undefined &&
      effectivePatch.status !== 'in_progress'
    ) {
      const autoGtd = getGTDForQuadrant(effectivePatch.quadrant)
      if (autoGtd) {
        effectivePatch.gtdList = autoGtd
      }
    }

    // Task 1 Reverse Bind: IF a task's GTD is changed to 'waiting' / 'waiting_for', auto-update quadrant to 'q3'
    const patchGtd = effectivePatch.gtdList as unknown as string
    if (patchGtd === 'waiting' || patchGtd === 'waiting_for') {
      effectivePatch.gtdList = 'waiting'
      if (effectivePatch.quadrant === undefined) {
        effectivePatch.quadrant = 'q3'
      }
    }

    const groupId = target.recallGroupId || target.srsGroupId
    const role = target.recallRole || target.srsRole

    // Task 1B: Automate Parent Recall Card Categorization
    // If a task is saved with Recall enabled, default the PARENT task's quadrant to 'q2'
    // if quadrant is not explicitly set (preserves manual promotion to Q1).
    const isRecall = Boolean(
      groupId ||
      role ||
      target.isRecall ||
      effectivePatch.isRecall
    )
    if (isRecall && effectivePatch.status !== 'in_progress' && effectivePatch.quadrant === undefined && !target.quadrant) {
      effectivePatch.quadrant = 'q2'
    }

    // When Recall is newly enabled on an existing task without a recallGroupId,
    // establish the recallGroupId on the parent and generate the 3 child recall tasks in Q2
    if (effectivePatch.isRecall && !groupId) {
      const newGroupId = `recall_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      effectivePatch.recallGroupId = newGroupId
      effectivePatch.recallRole = 'parent'
      effectivePatch.srsGroupId = newGroupId
      effectivePatch.srsRole = 'parent'
      effectivePatch.quadrant =
        effectivePatch.status === 'in_progress'
          ? getSmartInProgressQuadrant(effectivePatch.quadrant !== undefined ? effectivePatch.quadrant : target.quadrant)
          : (effectivePatch.quadrant || target.quadrant || 'q2')
      effectivePatch.tags = Array.from(new Set([...(target.tags || []), 'recall-parent']))

      const baseDateStr =
        effectivePatch.scheduledDate ||
        effectivePatch.dueDate ||
        target.scheduledDate ||
        target.dueDate ||
        format(new Date(), 'yyyy-MM-dd')
      const baseTitle = (effectivePatch.title || target.title).trim()

      const d1 = calculateRecallChildDate(baseDateStr, 1)
      const child1: Task = {
        id: `rec_${Date.now()}_1_${Math.random().toString(36).slice(2, 6)}`,
        title: `1st Recall (24h): ${baseTitle}`,
        notes: `1st Recall (24h spaced interval) for "${baseTitle}". Revisit core concepts and verify recall.`,
        status: 'draft',
        gtdList: 'scheduled',
        quadrant: 'q2',
        priority: target.priority || 'medium',
        dueDate: d1,
        scheduledDate: d1,
        recallGroupId: newGroupId,
        recallRole: 'child',
        srsGroupId: newGroupId,
        srsRole: 'child',
        isRecall: true,
        estimateMin: 15,
        context: target.context || ['@computer'],
        tags: ['recall-review', '24h'],
        projectId: target.projectId || null,
        areaId: target.areaId || null,
        waitingFor: null,
        subtasks: [],
        calendarEventId: null,
        order: 1001,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: 1,
      }

      const d2 = calculateRecallChildDate(baseDateStr, 14)
      const child2: Task = {
        id: `rec_${Date.now()}_2_${Math.random().toString(36).slice(2, 6)}`,
        title: `2nd Recall (2 weeks): ${baseTitle}`,
        notes: `2nd Recall (2 weeks spaced interval) for "${baseTitle}". Test retention and practical execution.`,
        status: 'draft',
        gtdList: 'scheduled',
        quadrant: 'q2',
        priority: target.priority || 'medium',
        dueDate: d2,
        scheduledDate: d2,
        recallGroupId: newGroupId,
        recallRole: 'child',
        srsGroupId: newGroupId,
        srsRole: 'child',
        isRecall: true,
        estimateMin: 20,
        context: target.context || ['@computer'],
        tags: ['recall-review', '2w'],
        projectId: target.projectId || null,
        areaId: target.areaId || null,
        waitingFor: null,
        subtasks: [],
        calendarEventId: null,
        order: 1002,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: 1,
      }

      const d3 = calculateRecallChildDate(baseDateStr, 60)
      const child3: Task = {
        id: `rec_${Date.now()}_3_${Math.random().toString(36).slice(2, 6)}`,
        title: `3rd Recall (2 months): ${baseTitle}`,
        notes: `3rd Recall (2 months spaced interval) for "${baseTitle}". Verify long-term retention and mastery.`,
        status: 'draft',
        gtdList: 'scheduled',
        quadrant: 'q2',
        priority: target.priority || 'medium',
        dueDate: d3,
        scheduledDate: d3,
        recallGroupId: newGroupId,
        recallRole: 'child',
        srsGroupId: newGroupId,
        srsRole: 'child',
        isRecall: true,
        estimateMin: 30,
        context: target.context || ['@computer'],
        tags: ['recall-review', '2m'],
        projectId: target.projectId || null,
        areaId: target.areaId || null,
        waitingFor: null,
        subtasks: [],
        calendarEventId: null,
        order: 1003,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: 1,
      }

      repos.tasks.create(child1).catch(() => {})
      repos.tasks.create(child2).catch(() => {})
      repos.tasks.create(child3).catch(() => {})

      const updatedParent: Task = {
        ...target,
        ...effectivePatch,
        updatedAt: new Date().toISOString(),
      }

      set({
        tasks: [updatedParent, child1, child2, child3, ...currentTasks.filter((t) => t.id !== id)],
      })

      repos.tasks.update(id, effectivePatch).catch(() => {})
      return
    }

    const newScheduledDate =
      effectivePatch.scheduledDate !== undefined
        ? effectivePatch.scheduledDate
        : effectivePatch.dueDate !== undefined
        ? effectivePatch.dueDate
        : undefined

    const hasNewDate = Boolean(
      newScheduledDate && typeof newScheduledDate === 'string' && newScheduledDate.trim().length > 0
    )

    // CASE 1: PARENT TASK RESCHEDULE
    if (role === 'parent' && groupId && hasNewDate && newScheduledDate) {
      const parentNewDateStr = newScheduledDate.trim().split('T')[0]

      const updatedTasks = currentTasks.map((t) => {
        const tGroupId = t.recallGroupId || t.srsGroupId
        const tRole = t.recallRole || t.srsRole

        if (t.id === id) {
          return {
            ...t,
            ...effectivePatch,
            scheduledDate: parentNewDateStr,
            dueDate: parentNewDateStr,
            recallGroupId: groupId,
            recallRole: 'parent' as const,
            srsGroupId: groupId,
            srsRole: 'parent' as const,
            updatedAt: new Date().toISOString(),
          }
        }
        if (tGroupId === groupId && (tRole === 'child' || t.id !== id)) {
          const intervalDays = getRecallIntervalDays(t)
          const childNewDate = calculateRecallChildDate(parentNewDateStr, intervalDays)
          return {
            ...t,
            scheduledDate: childNewDate,
            dueDate: childNewDate,
            recallGroupId: groupId,
            recallRole: 'child' as const,
            srsGroupId: groupId,
            srsRole: 'child' as const,
            updatedAt: new Date().toISOString(),
          }
        }
        return t
      })

      set({ tasks: updatedTasks })

      try {
        repos.tasks.update(id, {
          ...effectivePatch,
          scheduledDate: parentNewDateStr,
          dueDate: parentNewDateStr,
          recallGroupId: groupId,
          recallRole: 'parent',
        }).catch(() => {})

        const children = updatedTasks.filter(
          (t) => (t.recallGroupId === groupId || t.srsGroupId === groupId) && t.id !== id
        )
        for (const child of children) {
          repos.tasks.update(child.id, {
            scheduledDate: child.scheduledDate,
            dueDate: child.dueDate,
          }).catch(() => {})
        }
      } catch {}
      return
    }

    // CASE 2: CHILD RECALL TASK RESCHEDULE OR COMPLETION (ANTI-PROCRASTINATION & INTERVAL PRESERVATION)
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const isCompleting = effectivePatch.status === 'done' && target.status !== 'done'

    let triggerDateStr: string | undefined = undefined
    if (hasNewDate && newScheduledDate) {
      triggerDateStr = String(newScheduledDate).trim().split('T')[0]
    } else if (isCompleting) {
      triggerDateStr = todayStr
    }

    if (role === 'child' && groupId && triggerDateStr) {
      const oldDateStr = (target.scheduledDate || target.dueDate || triggerDateStr).trim().split('T')[0]
      const deltaDays = getCalendarDaysDiff(triggerDateStr, oldDateStr)

      // If no change in date, execute standard update
      if (deltaDays === 0) {
        const updatedTasks = currentTasks.map((t) =>
          t.id === id ? { ...t, ...effectivePatch, updatedAt: new Date().toISOString() } : t
        )
        set({ tasks: updatedTasks })
        try {
          repos.tasks.update(id, effectivePatch).catch(() => {})
        } catch {}
        return
      }

      const currentStep = getRecallCardStep(target)
      const baseTitle = extractBaseRecallTitle(target.title)

      const isCompletionAction = effectivePatch.status === 'done'
      const isGracePeriod = deltaDays <= 2

      // RULE A: FORWARD CASCADING SHIFT
      // Applied when:
      // 1. User is completing the task (recall success: do not penalize late completion, preserve interval)
      // 2. Rescheduling within Grace Period (deltaDays <= 2)
      if (isCompletionAction || isGracePeriod) {
        const updatedTasks = currentTasks.map((t) => {
          const tGroupId = t.recallGroupId || t.srsGroupId
          const tRole = t.recallRole || t.srsRole

          if (t.id === id) {
            return {
              ...t,
              ...effectivePatch,
              scheduledDate: triggerDateStr,
              dueDate: triggerDateStr,
              recallGroupId: groupId,
              recallRole: 'child' as const,
              srsGroupId: groupId,
              srsRole: 'child' as const,
              updatedAt: new Date().toISOString(),
            }
          }

          // Subsequent child card in the sequence: shift forward by deltaDays
          if (tGroupId === groupId && tRole === 'child' && getRecallCardStep(t) > currentStep) {
            const childCurrentDate = (t.scheduledDate || t.dueDate || triggerDateStr).trim().split('T')[0]
            const shiftedChildDate = calculateRecallChildDate(childCurrentDate, deltaDays)
            return {
              ...t,
              scheduledDate: shiftedChildDate,
              dueDate: shiftedChildDate,
              recallGroupId: groupId,
              recallRole: 'child' as const,
              srsGroupId: groupId,
              srsRole: 'child' as const,
              updatedAt: new Date().toISOString(),
            }
          }

          return t
        })

        set({ tasks: updatedTasks })

        try {
          repos.tasks.update(id, {
            ...effectivePatch,
            scheduledDate: triggerDateStr,
            dueDate: triggerDateStr,
          }).catch(() => {})

          const subsequent = updatedTasks.filter(
            (t) =>
              (t.recallGroupId === groupId || t.srsGroupId === groupId) &&
              (t.recallRole === 'child' || t.srsRole === 'child') &&
              getRecallCardStep(t) > currentStep
          )
          for (const s of subsequent) {
            repos.tasks.update(s.id, {
              scheduledDate: s.scheduledDate,
              dueDate: s.dueDate,
            }).catch(() => {})
          }
        } catch {}
        return
      }

      // RULE B: RESET PENALTY (deltaDays > 2 AND user is explicitly rescheduling, NOT completing)
      // Cognitive retention curve broken due to procrastination:
      // 1. Change current card title back to "1st Recall (24h)"
      // 2. Delete all subsequent child cards for this recallGroupId
      // 3. Regenerate new "2nd Recall" (+14d) and "3rd Recall" (+60d) based on new date
      const subsequentToDelete = currentTasks.filter(
        (t) =>
          (t.recallGroupId === groupId || t.srsGroupId === groupId) &&
          (t.recallRole === 'child' || t.srsRole === 'child') &&
          t.id !== id &&
          getRecallCardStep(t) > currentStep
      )
      const deleteIds = new Set(subsequentToDelete.map((t) => t.id))

      // Task 3: Filter out old interval tags ('2w', '2m', '14d', '60d') and safely merge with ['recall-review', '24h']
      const baseTags = effectivePatch.tags !== undefined ? effectivePatch.tags : target.tags || []
      const oldIntervalTags = new Set(['2w', '2m', '14d', '60d'])
      const preservedTags = baseTags.filter((tag) => !oldIntervalTags.has(tag.toLowerCase()))
      const mergedTags = Array.from(new Set([...preservedTags, 'recall-review', '24h']))

      const updatedCurrentCard: Task = {
        ...target,
        ...effectivePatch,
        title: `1st Recall (24h): ${baseTitle}`,
        scheduledDate: triggerDateStr,
        dueDate: triggerDateStr,
        recallGroupId: groupId,
        recallRole: 'child',
        srsGroupId: groupId,
        srsRole: 'child',
        tags: mergedTags,
        notes: `1st Recall (24h - Reset Penalty): Delay of ${deltaDays}d broke the cognitive retention curve. Rebuilding foundational recall memory trace for "${baseTitle}".`,
        updatedAt: new Date().toISOString(),
      }

      const newDate2 = calculateRecallChildDate(triggerDateStr, 14)
      const newChild2: Task = {
        id: `rec_${Date.now()}_2_${Math.random().toString(36).slice(2, 6)}`,
        title: `2nd Recall (2 weeks): ${baseTitle}`,
        notes: `2nd Recall (2 weeks) for "${baseTitle}". Retention evaluation following Reset Penalty recovery.`,
        status: 'draft',
        gtdList: 'scheduled',
        quadrant: 'q2', // Rule 2: Explicitly assign quadrant: 'q2' (Schedule) by default
        priority: target.priority || 'medium',
        dueDate: newDate2,
        scheduledDate: newDate2,
        recallGroupId: groupId,
        recallRole: 'child',
        srsGroupId: groupId,
        srsRole: 'child',
        estimateMin: 20,
        context: target.context || ['@computer'],
        tags: ['recall-review', '2w'],
        projectId: target.projectId || null,
        areaId: target.areaId || null,
        waitingFor: null,
        subtasks: [],
        calendarEventId: null,
        order: 1002,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: 1,
      }

      const newDate3 = calculateRecallChildDate(triggerDateStr, 60)
      const newChild3: Task = {
        id: `rec_${Date.now()}_3_${Math.random().toString(36).slice(2, 6)}`,
        title: `3rd Recall (2 months): ${baseTitle}`,
        notes: `3rd Recall (2 months) for "${baseTitle}". Long-term mastery verification following Reset Penalty recovery.`,
        status: 'draft',
        gtdList: 'scheduled',
        quadrant: 'q2', // Rule 2: Explicitly assign quadrant: 'q2' (Schedule) by default
        priority: target.priority || 'medium',
        dueDate: newDate3,
        scheduledDate: newDate3,
        recallGroupId: groupId,
        recallRole: 'child',
        srsGroupId: groupId,
        srsRole: 'child',
        estimateMin: 30,
        context: target.context || ['@computer'],
        tags: ['recall-review', '2m'],
        projectId: target.projectId || null,
        areaId: target.areaId || null,
        waitingFor: null,
        subtasks: [],
        calendarEventId: null,
        order: 1003,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: 1,
      }

      const survivingTasks = currentTasks
        .filter((t) => !deleteIds.has(t.id))
        .map((t) => (t.id === id ? updatedCurrentCard : t))

      const finalTasks = [...survivingTasks, newChild2, newChild3]
      set({ tasks: finalTasks })

      try {
        repos.tasks.update(id, updatedCurrentCard).catch(() => {})
        subsequentToDelete.forEach((del) => repos.tasks.remove(del.id).catch(() => {}))
        repos.tasks.create(newChild2).catch(() => {})
        repos.tasks.create(newChild3).catch(() => {})
      } catch {}
      return
    }

    // STANDARD TASK UPDATE
    const updatedTasks = currentTasks.map((t) =>
      t.id === id ? { ...t, ...effectivePatch, updatedAt: new Date().toISOString() } : t
    )
    set({ tasks: updatedTasks })

    try {
      repos.tasks.update(id, effectivePatch).catch(() => {})
    } catch {}
  },

  /**
   * Task 2: Schedule Action (Save Memory)
   * BEFORE mutating the task to Q2 (if it was uncategorized), you MUST save the exact current state
   * to the memory fields in the database payload:
   * previousQuadrant: task.quadrant || 'uncategorized'
   * previousGtd: task.gtd || 'next_action'
   */
  scheduleTask: (id, scheduleData) => {
    const currentTasks = get().tasks
    const target = currentTasks.find((t) => t.id === id)
    if (!target) return

    const previousQuadrant = target.quadrant || 'uncategorized'
    const previousGtd = target.gtd || target.gtdList || 'next_action'

    let nextQuadrant: EisenhowerQuadrant = 'q2'
    let nextGtd: GTDList = 'scheduled'

    if (previousQuadrant === 'q1' || previousQuadrant === 'do') {
      nextQuadrant = 'q1'
      nextGtd = (target.gtdList as GTDList) || 'next'
    } else if (previousQuadrant === 'q3' || previousQuadrant === 'delegate') {
      nextQuadrant = 'q3'
      nextGtd = 'waiting'
    } else if (previousQuadrant === 'q2' || previousQuadrant === 'schedule') {
      nextQuadrant = 'q2'
      nextGtd = 'scheduled'
    } else {
      nextQuadrant = 'q2'
      nextGtd = 'scheduled'
    }

    const payload: Partial<Task> = {
      ...scheduleData,
      previousQuadrant,
      previousGtd,
      quadrant: nextQuadrant,
      gtdList: nextGtd,
      gtd: nextGtd,
      updatedAt: new Date().toISOString(),
    }

    const updatedTasks = currentTasks.map((t) =>
      t.id === id ? { ...t, ...payload } : t
    )
    set({ tasks: updatedTasks })

    try {
      repos.tasks.update(id, payload).catch((err) => {
        console.error('[TaskStore] Failed to persist scheduleTask payload:', err)
      })
    } catch {}
  },

  /**
   * Task 3: Un-schedule Action (Restore Memory)
   * - REMOVE ANY hardcoded fallback to 'uncategorized' in this function.
   * - The mutation MUST strictly be:
   *   quadrant: task.previousQuadrant !== undefined ? task.previousQuadrant : task.quadrant
   *   gtd: task.previousGtd !== undefined ? task.previousGtd : task.gtd
   * - Clear previousQuadrant and previousGtd after restoring.
   */
  unscheduleTask: (id) => {
    const currentTasks = get().tasks
    const target = currentTasks.find((t) => t.id === id)
    if (target?.status === 'done') return

    const doUnschedule = (taskObj: Task) => {
      if (taskObj.status === 'done') return

      const hasPreviousQuadrant =
        typeof taskObj.previousQuadrant === 'string' && taskObj.previousQuadrant.trim().length > 0
      const restoredQuadrantRaw = hasPreviousQuadrant ? taskObj.previousQuadrant : taskObj.quadrant

      const hasPreviousGtd =
        typeof taskObj.previousGtd === 'string' && taskObj.previousGtd.trim().length > 0
      const restoredGtdRaw = hasPreviousGtd ? taskObj.previousGtd : (taskObj.gtd || taskObj.gtdList)

      let gtdListValue: GTDList = 'next'
      if (restoredGtdRaw === 'waiting' || restoredGtdRaw === 'waiting_for') {
        gtdListValue = 'waiting'
      } else if (restoredGtdRaw === 'scheduled') {
        gtdListValue = 'scheduled'
      } else if (restoredGtdRaw === 'someday') {
        gtdListValue = 'someday'
      } else if (restoredGtdRaw === 'next' || restoredGtdRaw === 'next_action') {
        gtdListValue = 'next'
      } else if (restoredQuadrantRaw === 'q3' || restoredQuadrantRaw === 'delegate') {
        gtdListValue = 'waiting'
      } else if (restoredQuadrantRaw === 'q4' || restoredQuadrantRaw === 'delete') {
        gtdListValue = 'someday'
      } else if (restoredQuadrantRaw === 'q2' || restoredQuadrantRaw === 'schedule') {
        gtdListValue = 'scheduled'
      }

      const payload: Partial<Task> = {
        quadrant: (restoredQuadrantRaw === 'uncategorized' ? null : restoredQuadrantRaw) as EisenhowerQuadrant,
        gtd: restoredGtdRaw,
        gtdList: gtdListValue,
        scheduledDate: null,
        dueDate: null,
        startTime: null,
        previousQuadrant: null,
        previousGtd: null,
        updatedAt: new Date().toISOString(),
      }

      if (restoredQuadrantRaw === 'uncategorized') {
        (payload as Record<string, unknown>).quadrant = 'uncategorized'
      }

      const updatedTasks = get().tasks.map((t) =>
        t.id === id ? { ...t, ...payload } : t
      )
      if (!get().tasks.some((t) => t.id === id)) {
        updatedTasks.push({ ...taskObj, ...payload })
      }
      set({ tasks: updatedTasks })

      try {
        repos.tasks.update(id, payload).catch((err) => {
          console.error('[TaskStore] Failed to persist unscheduleTask payload:', err)
        })
      } catch (err) {
        console.error('[TaskStore] Error in unscheduleTask update:', err)
      }
    }

    if (target) {
      doUnschedule(target)
    } else {
      repos.tasks.get(id).then((loaded) => {
        if (loaded) {
          doUnschedule(loaded)
        }
      })
    }
  },

  /**
   * Deletes a task. If the task has a recallGroupId, cascades and deletes ALL other tasks
   * sharing that exact recallGroupId.
   */
  deleteTask: (id) => {
    const currentTasks = get().tasks
    const target = currentTasks.find((t) => t.id === id)
    const groupId = target?.recallGroupId || target?.srsGroupId

    if (groupId) {
      const remaining = currentTasks.filter(
        (t) => (t.recallGroupId || t.srsGroupId) !== groupId
      )
      set({ tasks: remaining })
      try {
        const toDelete = currentTasks.filter(
          (t) => (t.recallGroupId || t.srsGroupId) === groupId
        )
        toDelete.forEach((t) => repos.tasks.remove(t.id).catch(() => {}))
      } catch {}
      return
    }

    set({ tasks: currentTasks.filter((t) => t.id !== id) })
    try {
      repos.tasks.remove(id).catch(() => {})
    } catch {}
  },

  /**
   * Explicit cascade delete for an entire Recall group.
   */
  cascadeDeleteRecall: (recallGroupId) => {
    const currentTasks = get().tasks
    set({
      tasks: currentTasks.filter(
        (t) => (t.recallGroupId || t.srsGroupId) !== recallGroupId
      ),
    })
    try {
      const toDelete = currentTasks.filter(
        (t) => (t.recallGroupId || t.srsGroupId) === recallGroupId
      )
      toDelete.forEach((t) => repos.tasks.remove(t.id).catch(() => {}))
    } catch {}
  },

  cascadeDeleteSRS: (srsGroupId) => {
    get().cascadeDeleteRecall(srsGroupId)
  },

  /**
   * Explicit cascade reschedule for child tasks of a Recall parent.
   */
  cascadeRescheduleRecall: (parentId, newScheduledDate) => {
    const currentTasks = get().tasks
    const parent = currentTasks.find((t) => t.id === parentId)
    const groupId = parent?.recallGroupId || parent?.srsGroupId
    if (!groupId) return

    const parentDate = String(newScheduledDate).trim().split('T')[0]
    const updatedTasks = currentTasks.map((t) => {
      const tGroupId = t.recallGroupId || t.srsGroupId
      const tRole = t.recallRole || t.srsRole

      if (t.id === parentId) {
        return {
          ...t,
          scheduledDate: parentDate,
          dueDate: parentDate,
          recallGroupId: groupId,
          recallRole: 'parent' as const,
          updatedAt: new Date().toISOString(),
        }
      }
      if (tGroupId === groupId && (tRole === 'child' || t.id !== parentId)) {
        const intervalDays = getRecallIntervalDays(t)
        const childDate = calculateRecallChildDate(parentDate, intervalDays)
        return {
          ...t,
          scheduledDate: childDate,
          dueDate: childDate,
          recallGroupId: groupId,
          recallRole: 'child' as const,
          updatedAt: new Date().toISOString(),
        }
      }
      return t
    })

    set({ tasks: updatedTasks })
    try {
      repos.tasks.update(parentId, { scheduledDate: parentDate, dueDate: parentDate }).catch(() => {})
      const children = updatedTasks.filter(
        (t) => (t.recallGroupId || t.srsGroupId) === groupId && t.id !== parentId
      )
      children.forEach((c) =>
        repos.tasks.update(c.id, { scheduledDate: c.scheduledDate, dueDate: c.dueDate }).catch(() => {})
      )
    } catch {}
  },

  cascadeRescheduleSRS: (parentId, newScheduledDate) => {
    get().cascadeRescheduleRecall(parentId, newScheduledDate)
  },
}))

if (typeof window !== 'undefined') {
  ;(window as any).__taskStore = useTaskStore
}
