import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { repos } from '@/data'
import { Task, EisenhowerQuadrant } from '@/data/ports/schemas'
import { QueryOpts } from '@/data/ports/Repo'
import {
  calculateRecallChildDate,
  getRecallIntervalDays,
  getSmartInProgressQuadrant,
  getSmartInProgressMapping,
  getSmartDraftRevertMapping,
  getGTDForQuadrant,
  useTaskStore,
} from '@/app/store/taskStore'

export const TASKS_QUERY_KEY = ['tasks']

export function useTasks(queryOpts?: QueryOpts) {
  const queryClient = useQueryClient()
  const setTasksInStore = useTaskStore((s) => s.setTasks)

  useEffect(() => {
    if (repos.tasks.subscribe) {
      const unsubscribe = repos.tasks.subscribe((items) => {
        queryClient.setQueryData(TASKS_QUERY_KEY, items)
        setTasksInStore(items)
      })
      return () => unsubscribe()
    }
  }, [queryClient, setTasksInStore])

  return useQuery({
    queryKey: queryOpts ? [...TASKS_QUERY_KEY, queryOpts] : TASKS_QUERY_KEY,
    queryFn: async () => {
      const list = await repos.tasks.list(queryOpts)
      setTasksInStore(list)
      return list
    },
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>) => {
      const isRecall = Boolean(
        newTask.recallGroupId ||
        newTask.srsGroupId ||
        newTask.recallRole ||
        newTask.isRecall
      )

      // When Recall is enabled on creation and no recallGroupId is yet assigned,
      // generate the parent recall task (quadrant: 'q2') AND all 3 spaced child cards (+1d, +14d, +60d)
      if (isRecall && !newTask.recallGroupId) {
        const recallGroupId = `recall_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const baseDateStr = newTask.scheduledDate || newTask.dueDate || format(new Date(), 'yyyy-MM-dd')
        const baseTitle = newTask.title.trim()

        const parentTaskToCreate = {
          ...newTask,
          status: newTask.status || 'draft',
          gtdList: newTask.gtdList || 'scheduled',
          quadrant: (newTask.status === 'in_progress'
            ? getSmartInProgressQuadrant(newTask.quadrant)
            : (newTask.quadrant || 'q2')) as EisenhowerQuadrant,
          dueDate: baseDateStr,
          scheduledDate: baseDateStr,
          recallGroupId,
          recallRole: 'parent' as const,
          srsGroupId: recallGroupId,
          srsRole: 'parent' as const,
          isRecall: true,
          tags: newTask.tags && newTask.tags.length > 0 ? Array.from(new Set([...newTask.tags, 'recall-parent'])) : ['recall-parent'],
          schemaVersion: 1,
        }

        const createdParent = await repos.tasks.create(parentTaskToCreate)
        useTaskStore.getState().addTask(createdParent)

        // Child 1: 1st Recall (24h)
        const date1 = calculateRecallChildDate(baseDateStr, 1)
        const child1 = await repos.tasks.create({
          title: `1st Recall (24h): ${baseTitle}`,
          notes: `1st Recall (24h spaced interval) for "${baseTitle}". Revisit core concepts and verify recall.`,
          status: 'draft',
          gtdList: 'scheduled',
          quadrant: 'q2',
          priority: newTask.priority || 'medium',
          dueDate: date1,
          scheduledDate: date1,
          recallGroupId,
          recallRole: 'child',
          srsGroupId: recallGroupId,
          srsRole: 'child',
          isRecall: true,
          estimateMin: 15,
          context: newTask.context || ['@computer'],
          tags: ['recall-review', '24h'],
          projectId: newTask.projectId || null,
          areaId: newTask.areaId || null,
          waitingFor: null,
          subtasks: [],
          calendarEventId: null,
          order: 1001,
          completedAt: null,
          schemaVersion: 1,
        })
        useTaskStore.getState().addTask(child1)

        // Child 2: 2nd Recall (2 weeks)
        const date2 = calculateRecallChildDate(baseDateStr, 14)
        const child2 = await repos.tasks.create({
          title: `2nd Recall (2 weeks): ${baseTitle}`,
          notes: `2nd Recall (2 weeks spaced interval) for "${baseTitle}". Test retention and practical execution.`,
          status: 'draft',
          gtdList: 'scheduled',
          quadrant: 'q2',
          priority: newTask.priority || 'medium',
          dueDate: date2,
          scheduledDate: date2,
          recallGroupId,
          recallRole: 'child',
          srsGroupId: recallGroupId,
          srsRole: 'child',
          isRecall: true,
          estimateMin: 20,
          context: newTask.context || ['@computer'],
          tags: ['recall-review', '2w'],
          projectId: newTask.projectId || null,
          areaId: newTask.areaId || null,
          waitingFor: null,
          subtasks: [],
          calendarEventId: null,
          order: 1002,
          completedAt: null,
          schemaVersion: 1,
        })
        useTaskStore.getState().addTask(child2)

        // Child 3: 3rd Recall (2 months)
        const date3 = calculateRecallChildDate(baseDateStr, 60)
        const child3 = await repos.tasks.create({
          title: `3rd Recall (2 months): ${baseTitle}`,
          notes: `3rd Recall (2 months spaced interval) for "${baseTitle}". Verify long-term retention and mastery.`,
          status: 'draft',
          gtdList: 'scheduled',
          quadrant: 'q2',
          priority: newTask.priority || 'medium',
          dueDate: date3,
          scheduledDate: date3,
          recallGroupId,
          recallRole: 'child',
          srsGroupId: recallGroupId,
          srsRole: 'child',
          isRecall: true,
          estimateMin: 30,
          context: newTask.context || ['@computer'],
          tags: ['recall-review', '2m'],
          projectId: newTask.projectId || null,
          areaId: newTask.areaId || null,
          waitingFor: null,
          subtasks: [],
          calendarEventId: null,
          order: 1003,
          completedAt: null,
          schemaVersion: 1,
        })
        useTaskStore.getState().addTask(child3)

        return [createdParent, child1, child2, child3]
      }

      // Task 1: The Q3 / Waiting For Two-Way Bind & Task 2: Someday Rule
      let effectiveGtd = newTask.gtdList || 'scheduled'
      let effectiveQuadrant: EisenhowerQuadrant = newTask.quadrant || null

      if (effectiveGtd === 'waiting' || (effectiveGtd as unknown as string) === 'waiting_for') {
        effectiveGtd = 'waiting'
        if (!effectiveQuadrant) {
          effectiveQuadrant = 'q3'
        }
      } else if ((effectiveQuadrant === 'q3' || effectiveQuadrant === 'delegate') && (!newTask.gtdList || newTask.gtdList === 'next')) {
        effectiveGtd = 'waiting'
      }

      // Task 2: If created as gtd: 'someday', default to uncategorized and draft
      if (effectiveGtd === 'someday' && !newTask.quadrant) {
        effectiveQuadrant = null
      }

      // Normal tasks remain untouched and default to null (landing safely in Inbox Tray)
      const taskToCreate = {
        ...newTask,
        status: effectiveGtd === 'someday' ? (newTask.status || 'draft') : (newTask.status || 'draft'),
        gtdList: effectiveGtd,
        quadrant: (newTask.status === 'in_progress'
          ? getSmartInProgressQuadrant(effectiveQuadrant)
          : isRecall
          ? (effectiveQuadrant || 'q2')
          : effectiveQuadrant) as EisenhowerQuadrant,
        schemaVersion: 1,
      }
      const created = await repos.tasks.create(taskToCreate)
      useTaskStore.getState().addTask(created)
      return [created]
    },
    onSuccess: (createdList: Task[]) => {
      queryClient.setQueryData(TASKS_QUERY_KEY, (old: Task[] = []) => {
        const newIds = new Set(createdList.map((t) => t.id))
        return [...createdList, ...old.filter((t) => !newIds.has(t.id))]
      })
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      // If scheduledDate is updated, ensure dueDate matches and vice-versa
      const effectiveScheduledDate =
        patch.scheduledDate !== undefined
          ? patch.scheduledDate
          : patch.dueDate !== undefined
          ? patch.dueDate
          : undefined

      const effectivePatch: Partial<Task> = { ...patch }
      if (effectiveScheduledDate !== undefined && effectiveScheduledDate !== null) {
        const cleanDate = String(effectiveScheduledDate).trim().split('T')[0]
        effectivePatch.scheduledDate = cleanDate
        effectivePatch.dueDate = cleanDate
      }
      const existingTask = useTaskStore.getState().tasks.find((t) => t.id === id)

      // Status Memory: record previousStatus when completing task
      if (effectivePatch.status === 'done' && existingTask?.status !== 'done' && effectivePatch.previousStatus === undefined) {
        effectivePatch.previousStatus = existingTask?.status
      } else if (effectivePatch.status && effectivePatch.status !== 'done' && existingTask?.status === 'done' && effectivePatch.previousStatus === undefined) {
        effectivePatch.previousStatus = null
      }

      // Task 2: The "In Progress" Smart Trigger (Kanban Drag)
      if (effectivePatch.status === 'in_progress' && existingTask?.status !== 'in_progress') {
        const mapping = getSmartInProgressMapping(
          effectivePatch.quadrant !== undefined ? effectivePatch.quadrant : existingTask?.quadrant,
          effectivePatch.gtdList !== undefined ? effectivePatch.gtdList : existingTask?.gtdList
        )
        if (mapping.quadrant !== undefined && effectivePatch.quadrant === undefined) {
          effectivePatch.quadrant = mapping.quadrant
        }
        if (mapping.gtdList !== undefined && effectivePatch.gtdList === undefined) {
          effectivePatch.gtdList = mapping.gtdList
        }
      } else if (effectivePatch.status === 'draft' && existingTask?.status === 'in_progress') {
        // Task 3: The "Draft" Revert Memory
        const revertMapping = getSmartDraftRevertMapping(
          effectivePatch.quadrant !== undefined ? effectivePatch.quadrant : existingTask?.quadrant,
          effectivePatch.gtdList !== undefined ? effectivePatch.gtdList : existingTask?.gtdList,
          existingTask?.status
        )
        if (revertMapping.gtdList !== undefined && effectivePatch.gtdList === undefined) {
          effectivePatch.gtdList = revertMapping.gtdList
        }
      }

      // Task 3: Uncategorized Safe Demotion (Edge Case)
      if (effectivePatch.quadrant === null && existingTask?.quadrant !== null) {
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

      // Task 1: The Q3 / Waiting For Two-Way Bind
      const patchGtd = effectivePatch.gtdList as unknown as string
      if (patchGtd === 'waiting' || patchGtd === 'waiting_for') {
        effectivePatch.gtdList = 'waiting'
        if (effectivePatch.quadrant === undefined) {
          effectivePatch.quadrant = 'q3'
        }
      } else if (
        effectivePatch.quadrant === 'q3' ||
        effectivePatch.quadrant === 'delegate'
      ) {
        if (effectivePatch.gtdList === undefined) {
          effectivePatch.gtdList = 'waiting'
        }
      }

      // Automate Parent Recall Card Categorization: Default to 'q2' if quadrant is unassigned
      const isRecall = Boolean(
        effectivePatch.recallGroupId ||
        effectivePatch.recallRole ||
        effectivePatch.isRecall ||
        existingTask?.isRecall ||
        existingTask?.recallGroupId
      )
      if (isRecall && effectivePatch.status !== 'in_progress' && effectivePatch.quadrant === undefined && !existingTask?.quadrant) {
        effectivePatch.quadrant = 'q2'
      }

      // Delegate to taskStore.updateTask (handles Grace Period, Reset Penalty & repo persist)
      useTaskStore.getState().updateTask(id, effectivePatch)

      // Update the target task in repository
      return await repos.tasks.update(id, effectivePatch)
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY })
      const previous = queryClient.getQueryData<Task[]>(TASKS_QUERY_KEY) || []
      const target = previous.find((t) => t.id === id)

      const effectiveScheduledDate =
        patch.scheduledDate !== undefined
          ? patch.scheduledDate
          : patch.dueDate !== undefined
          ? patch.dueDate
          : undefined

      const groupId = target?.recallGroupId || target?.srsGroupId
      const role = target?.recallRole || target?.srsRole

      const isParentRecall = Boolean(
        groupId && (role === 'parent' || !role) && effectiveScheduledDate
      )

      const parentDateStr = effectiveScheduledDate
        ? String(effectiveScheduledDate).trim().split('T')[0]
        : undefined

      queryClient.setQueryData<Task[]>(
        TASKS_QUERY_KEY,
        previous.map((t) => {
          if (t.id === id) {
            let nextQuadrant = patch.quadrant !== undefined ? patch.quadrant : t.quadrant
            let nextGtd = patch.gtdList !== undefined ? patch.gtdList : t.gtdList

            if (patch.status === 'in_progress' && t.status !== 'in_progress') {
              const mapping = getSmartInProgressMapping(nextQuadrant, nextGtd)
              if (mapping.quadrant !== undefined) nextQuadrant = mapping.quadrant
              if (mapping.gtdList !== undefined) nextGtd = mapping.gtdList
            } else if (patch.status === 'draft' && t.status === 'in_progress') {
              const revertMapping = getSmartDraftRevertMapping(nextQuadrant, nextGtd, t.status)
              if (revertMapping.gtdList !== undefined) nextGtd = revertMapping.gtdList
            } else if (patch.quadrant !== undefined && patch.gtdList === undefined) {
              const autoGtd = getGTDForQuadrant(patch.quadrant)
              if (autoGtd) nextGtd = autoGtd
            }

            // Task 3: Uncategorized Safe Demotion (Edge Case)
            if (patch.quadrant === null && t.quadrant !== null) {
              nextQuadrant = null
              if (patch.status === undefined) patch.status = 'draft'
              if (patch.gtdList === undefined) nextGtd = 'next'
            }

            const patchGtd = (patch.gtdList || nextGtd) as unknown as string
            if (patchGtd === 'waiting' || patchGtd === 'waiting_for') {
              nextGtd = 'waiting'
              if (patch.quadrant === undefined) nextQuadrant = 'q3'
            }

            const nextPreviousStatus =
              patch.previousStatus !== undefined
                ? patch.previousStatus
                : patch.status === 'done' && t.status !== 'done'
                ? t.status
                : patch.status && patch.status !== 'done' && t.status === 'done'
                ? null
                : t.previousStatus

            return {
              ...t,
              ...patch,
              status: patch.status !== undefined ? patch.status : t.status,
              previousStatus: nextPreviousStatus,
              quadrant: nextQuadrant,
              gtdList: nextGtd,
              ...(parentDateStr !== undefined && {
                scheduledDate: parentDateStr,
                dueDate: parentDateStr,
              }),
            }
          }
          if (
            isParentRecall &&
            (t.recallGroupId === groupId || t.srsGroupId === groupId) &&
            ((t.recallRole || t.srsRole) === 'child' || t.id !== id) &&
            parentDateStr
          ) {
            const intervalDays = getRecallIntervalDays(t)
            const newChildDate = calculateRecallChildDate(parentDateStr, intervalDays)
            return {
              ...t,
              scheduledDate: newChildDate,
              dueDate: newChildDate,
            }
          }
          return t
        })
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(TASKS_QUERY_KEY, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['timeBlocks'] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Sync with taskStore (Zustand)
      useTaskStore.getState().deleteTask(id)

      // 2. Inspect if task belongs to a Recall group
      let target: Task | null = null
      const cached = queryClient.getQueryData<Task[]>(TASKS_QUERY_KEY)
      if (cached) {
        target = cached.find((t) => t.id === id) || null
      }
      if (!target) {
        target = await repos.tasks.get(id)
      }

      const groupId = target?.recallGroupId || target?.srsGroupId
      // 3. Cascade Delete: If it has recallGroupId, delete ALL tasks sharing that recallGroupId
      if (groupId) {
        const allTasks = await repos.tasks.list()
        const recallTasks = allTasks.filter(
          (t) => (t.recallGroupId || t.srsGroupId) === groupId
        )
        if (recallTasks.length > 0) {
          await Promise.all(recallTasks.map((t) => repos.tasks.remove(t.id)))
          try {
            const allBlocks = await repos.timeBlocks.list()
            const matchingBlocks = allBlocks.filter(
              (b) => (b.taskId && recallTasks.some((rt) => rt.id === b.taskId)) || b.recallGroupId === groupId
            )
            await Promise.all(matchingBlocks.map((b) => repos.timeBlocks.remove(b.id)))
          } catch {}
          return
        }
      }

      // Otherwise delete single task and its linked timeblocks
      await repos.tasks.remove(id)
      try {
        const allBlocks = await repos.timeBlocks.list()
        const matchingBlocks = allBlocks.filter((b) => b.taskId === id)
        await Promise.all(matchingBlocks.map((b) => repos.timeBlocks.remove(b.id)))
      } catch {}
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY })
      const previous = queryClient.getQueryData<Task[]>(TASKS_QUERY_KEY) || []
      const target = previous.find((t) => t.id === id)
      const groupId = target?.recallGroupId || target?.srsGroupId

      if (groupId) {
        queryClient.setQueryData<Task[]>(
          TASKS_QUERY_KEY,
          previous.filter((t) => (t.recallGroupId || t.srsGroupId) !== groupId)
        )
      } else {
        queryClient.setQueryData<Task[]>(
          TASKS_QUERY_KEY,
          previous.filter((t) => t.id !== id)
        )
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(TASKS_QUERY_KEY, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['timeBlocks'] })
    },
  })
}
