import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { repos } from '@/data'
import { Task, TimeBlock } from '@/data/ports/schemas'
import { TASKS_QUERY_KEY } from './useTasks'
import { useTaskStore } from '@/app/store/taskStore'
import {
  pushBlockToGCal,
  deleteRemoteGCalEvent,
  syncTwoWay,
  isCalendarTokenValid,
} from '@/services/calendar'

export const TIMEBLOCKS_QUERY_KEY = ['timeBlocks']

export function getPreviousDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  const year = dt.getFullYear()
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getBlockDateKey(isoOrDateStr: string): string {
  try {
    const d = new Date(isoOrDateStr)
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  } catch {}
  return isoOrDateStr.slice(0, 10)
}

export function isBlockRelevantToDate(b: TimeBlock, selectedDate: string): boolean {
  const blockDate = getBlockDateKey(b.start)

  // 1. Its scheduled date is today
  if (blockDate === selectedDate || b.start.startsWith(selectedDate)) {
    return true
  }

  // 2. OR its scheduled date is yesterday AND (startTime in minutes + duration) > 1440 (crosses midnight)
  const yesterdayStr = getPreviousDateStr(selectedDate)
  if (blockDate === yesterdayStr || b.start.startsWith(yesterdayStr)) {
    const s = new Date(b.start)
    const e = new Date(b.end)
    const startMin = s.getHours() * 60 + s.getMinutes()
    const durationMin = Math.round((e.getTime() - s.getTime()) / (1000 * 60))
    return startMin + durationMin > 1440
  }

  return false
}

export function useTimeBlocks(selectedDate?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (repos.timeBlocks.subscribe) {
      const unsubscribe = repos.timeBlocks.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: TIMEBLOCKS_QUERY_KEY })
      })
      return () => unsubscribe()
    }
  }, [queryClient])

  return useQuery({
    queryKey: selectedDate ? [...TIMEBLOCKS_QUERY_KEY, selectedDate] : TIMEBLOCKS_QUERY_KEY,
    queryFn: async () => {
      const allBlocks = await repos.timeBlocks.list({ orderBy: 'start', orderDirection: 'asc' })
      if (!selectedDate) return allBlocks
      return allBlocks.filter((b) => isBlockRelevantToDate(b, selectedDate))
    },
  })
}

export function useCreateTimeBlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      newBlock: Omit<TimeBlock, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'> & {
        updatedAt?: string
      }
    ) => {
      const now = new Date().toISOString()
      const created = await repos.timeBlocks.create({
        ...newBlock,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      })

      // Outbound sync to Google Calendar if connected
      if (isCalendarTokenValid() && created.source !== 'gcal') {
        pushBlockToGCal(created)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: TIMEBLOCKS_QUERY_KEY })
          })
          .catch((err) => {
            console.debug('[TimeBlock] Google Calendar sync skipped/failed:', err)
          })
      }

      return created
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIMEBLOCKS_QUERY_KEY })
    },
  })
}

export function useUpdateTimeBlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TimeBlock> }) => {
      const updated = await repos.timeBlocks.update(id, patch)

      // Outbound sync update to Google Calendar
      if (isCalendarTokenValid() && updated.gcal?.eventId) {
        pushBlockToGCal(updated).catch((err) => {
          console.debug('[TimeBlock] GCal update push failed:', err)
        })
      }

      return updated
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: TIMEBLOCKS_QUERY_KEY })
      queryClient.setQueriesData<TimeBlock[]>({ queryKey: TIMEBLOCKS_QUERY_KEY }, (old) => {
        if (!old) return []
        return old.map((b) => (b.id === id ? { ...b, ...patch } : b))
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TIMEBLOCKS_QUERY_KEY })
    },
  })
}

export function useDeleteTimeBlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const existing = await repos.timeBlocks.get(id)
      if (existing?.gcal?.eventId && isCalendarTokenValid()) {
        deleteRemoteGCalEvent(existing.gcal.eventId).catch((err) => {
          console.debug('[TimeBlock] Remote GCal deletion failed:', err)
        })
      }

      await repos.timeBlocks.remove(id)

      // Task 3: Timeline Removal Logic (Un-scheduling / Strict Restoration)
      // Revert task's quadrant and gtd to previousQuadrant and previousGtd, and clear scheduledDate/time
      if (existing?.taskId) {
        useTaskStore.getState().unscheduleTask(existing.taskId)
      }

      return id
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TIMEBLOCKS_QUERY_KEY })
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY })

      const previousBlocks = queryClient.getQueriesData<TimeBlock[]>({ queryKey: TIMEBLOCKS_QUERY_KEY })
      let targetTaskId: string | null = null
      for (const [, blocks] of previousBlocks) {
        const found = blocks?.find((b) => b.id === id)
        if (found?.taskId) {
          targetTaskId = found.taskId
          break
        }
      }
      if (!targetTaskId) {
        const allBlocks = queryClient.getQueryData<TimeBlock[]>(TIMEBLOCKS_QUERY_KEY)
        const found = allBlocks?.find((b) => b.id === id)
        if (found?.taskId) targetTaskId = found.taskId
      }
      if (!targetTaskId) {
        const targetFromStore = useTaskStore.getState().tasks.find((t) => t.calendarEventId === id)
        if (targetFromStore) targetTaskId = targetFromStore.id
      }

      // Optimistically remove block from timeBlocks queries
      queryClient.setQueriesData<TimeBlock[]>({ queryKey: TIMEBLOCKS_QUERY_KEY }, (old) => {
        if (!old) return []
        return old.filter((b) => b.id !== id)
      })

      // Optimistically restore linked task state
      if (targetTaskId) {
        const taskId = targetTaskId
        useTaskStore.getState().unscheduleTask(taskId)
        const restoredTask = useTaskStore.getState().tasks.find((t) => t.id === taskId)
        queryClient.setQueryData<Task[]>(TASKS_QUERY_KEY, (oldTasks) => {
          if (!oldTasks) return []
          return oldTasks.map((t) => {
            if (t.id === taskId) {
              return {
                ...t,
                ...(restoredTask || {}),
                scheduledDate: null,
                dueDate: null,
                startTime: null,
                previousQuadrant: null,
                previousGtd: null,
              }
            }
            return t
          })
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIMEBLOCKS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useSyncGoogleCalendar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dateStr: string) => {
      return syncTwoWay(dateStr)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIMEBLOCKS_QUERY_KEY })
    },
  })
}
