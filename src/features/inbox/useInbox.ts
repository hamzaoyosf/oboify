import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { addDays, format, parseISO } from 'date-fns'
import { repos } from '@/data'
import { InboxItem } from '@/data/ports/schemas'
import { classifyInboxItemSync } from './mockAiCategorizer'
import {
  classifyInboxItemWithAI,
  batchClassifyInboxItems,
  isGeminiConfigured,
} from '@/services/ai'
import { usePreferencesStore } from '@/app/store/preferencesStore'
import { generateId } from '@/lib/id'

export const INBOX_QUERY_KEY = ['inbox']

export function extractCleanTaskNotes(aiReasoning?: string | null, fallbackText?: string): string {
  if (aiReasoning) {
    // Strip all bracketed context tags [AI Context: ...], [Next Action], etc.
    let cleaned = aiReasoning.replace(/\[[^\]]*\]/g, '')
    // Strip any robotic metadata, route messages, or status strings
    cleaned = cleaned.replace(/Converted from Inbox capture.*/gi, '')
    cleaned = cleaned.replace(/Heuristically routed to.*/gi, '')
    cleaned = cleaned.replace(/Routed to \w+ as.*/gi, '')
    cleaned = cleaned.replace(/^\s*[-:•]\s*/, '')
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    if (cleaned.length > 0) return cleaned
  }
  if (fallbackText) {
    return fallbackText.trim()
  }
  return ''
}

export interface ConvertToTaskParams {
  item: InboxItem
  enableRecall?: boolean
  enableSrs?: boolean
  scheduledDate?: string | null
  title?: string
}

export type ConvertToTaskArg = InboxItem | ConvertToTaskParams

export function useInbox() {
  const queryClient = useQueryClient()

  // Subscribe to live repository updates (multi-tab and intra-app mutations)
  useEffect(() => {
    if (repos.inbox.subscribe) {
      const unsubscribe = repos.inbox.subscribe((items) => {
        queryClient.setQueryData(INBOX_QUERY_KEY, items)
      })
      return () => unsubscribe()
    }
  }, [queryClient])

  return useQuery({
    queryKey: INBOX_QUERY_KEY,
    queryFn: () => repos.inbox.list(),
  })
}

export function useCreateInboxItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ text, source = 'quick_capture' }: { text: string; source?: string }) => {
      // 1. Instant local heuristic classification for zero-latency write
      const initialAi = classifyInboxItemSync(text)
      const createdItem = await repos.inbox.create({
        text,
        source,
        status: 'unprocessed',
        ai: initialAi,
        processedAt: null,
        convertedTo: null,
        schemaVersion: 1,
      })

      // 2. If Gemini is configured and AI auto-categorization is enabled, upgrade with live AI inference in the background
      const isAutoCategorizeEnabled = usePreferencesStore.getState?.()?.aiAutoCategorize ?? true
      if (isGeminiConfigured() && isAutoCategorizeEnabled) {
        classifyInboxItemWithAI(text, { fallbackToHeuristic: false })
          .then(async (aiResult) => {
            await repos.inbox.update(createdItem.id, {
              ai: {
                category: aiResult.category,
                priority: aiResult.priority,
                suggestedDue: aiResult.suggestedDue || null,
                confidence: aiResult.confidence,
                model: aiResult.model,
                accepted: null,
                reasoning: aiResult.reasoning,
                tags: aiResult.tags,
                suggestedQuadrant: aiResult.suggestedQuadrant,
                estimateMin: aiResult.estimateMin,
                context: aiResult.context,
                hub: aiResult.hub,
                estimatedTime: aiResult.estimatedTime,
              },
            })
            queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY })
          })
          .catch((err) => {
            console.debug('[Inbox] Background Gemini classification skipped/failed:', err)
          })
      }

      return createdItem
    },
    // Sub-100ms optimistic cache update (SRS FR-INB-02)
    onMutate: async (newCapture) => {
      await queryClient.cancelQueries({ queryKey: INBOX_QUERY_KEY })
      const previousItems = queryClient.getQueryData<InboxItem[]>(INBOX_QUERY_KEY) || []

      const optimisticItem: InboxItem = {
        id: generateId('inb_opt'),
        text: newCapture.text,
        source: newCapture.source || 'quick_capture',
        status: 'unprocessed',
        ai: classifyInboxItemSync(newCapture.text),
        createdAt: new Date().toISOString(),
        processedAt: null,
        convertedTo: null,
        schemaVersion: 1,
      }

      queryClient.setQueryData<InboxItem[]>(INBOX_QUERY_KEY, [optimisticItem, ...previousItems])

      return { previousItems }
    },
    onError: (_err, _newCapture, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(INBOX_QUERY_KEY, context.previousItems)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY })
    },
  })
}

export function useAICategorizeInboxItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, text }: { itemId: string; text: string }) => {
      const result = await classifyInboxItemWithAI(text, { fallbackToHeuristic: false })
      await repos.inbox.update(itemId, {
        ai: {
          category: result.category,
          priority: result.priority,
          suggestedDue: result.suggestedDue || null,
          confidence: result.confidence,
          model: result.model,
          accepted: true,
          reasoning: result.reasoning,
          tags: result.tags,
          suggestedQuadrant: result.suggestedQuadrant,
          estimateMin: result.estimateMin,
          context: result.context,
          hub: result.hub,
          estimatedTime: result.estimatedTime,
        },
      })
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY })
    },
  })
}

export function useBatchAICategorizeInbox() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (items: Array<{ id: string; text: string }>) => {
      const results = await batchClassifyInboxItems(items)
      for (const [id, result] of results.entries()) {
        await repos.inbox.update(id, {
          ai: {
            category: result.category,
            priority: result.priority,
            suggestedDue: result.suggestedDue || null,
            confidence: result.confidence,
            model: result.model,
            accepted: true,
            reasoning: result.reasoning,
            tags: result.tags,
            suggestedQuadrant: result.suggestedQuadrant,
            estimateMin: result.estimateMin,
            context: result.context,
            hub: result.hub,
            estimatedTime: result.estimatedTime,
          },
        })
      }
      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY })
    },
  })
}

export function useConvertToTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (arg: ConvertToTaskArg) => {
      const inboxItem = 'text' in arg ? arg : arg.item
      const enableRecall =
        'enableRecall' in arg
          ? Boolean(arg.enableRecall)
          : 'enableSrs' in arg
          ? Boolean(arg.enableSrs)
          : false
      const customTitle = 'title' in arg && arg.title ? arg.title.trim() : inboxItem.text.trim()
      const providedDate = 'scheduledDate' in arg ? arg.scheduledDate : undefined

      const ai = inboxItem.ai
      const cleanNotes = extractCleanTaskNotes(ai?.reasoning, inboxItem.text)

      // Determine GTD list from AI Context classification
      let gtdList: 'next' | 'scheduled' | 'waiting' | 'someday' = 'next'
      if (ai?.context === 'Waiting For') gtdList = 'waiting'
      else if (ai?.context === 'Scheduled') gtdList = 'scheduled'
      else if (ai?.context === 'Someday') gtdList = 'someday'
      else if (ai?.context === 'Next Action') gtdList = 'next'

      // Parse estimate minutes from estimatedTime if present
      let estimateMin = ai?.estimateMin || 15
      if (ai?.estimatedTime) {
        if (ai.estimatedTime.endsWith('h')) {
          const hours = parseFloat(ai.estimatedTime)
          if (!isNaN(hours)) estimateMin = Math.round(hours * 60)
        } else if (ai.estimatedTime.endsWith('m')) {
          const mins = parseInt(ai.estimatedTime, 10)
          if (!isNaN(mins)) estimateMin = mins
        }
      }

      const effectiveDate = providedDate !== undefined ? providedDate : ai?.suggestedDue || null

      if (enableRecall) {
        // Generate unique Recall Group ID
        const recallGroupId = `recall_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const baseDateStr = effectiveDate || format(new Date(), 'yyyy-MM-dd')
        const baseDate = baseDateStr.includes('T') ? parseISO(baseDateStr) : new Date(baseDateStr + 'T00:00:00')

        // 1. Create Base Parent Task
        const parentTask = await repos.tasks.create({
          title: customTitle,
          notes: cleanNotes,
          status: 'draft',
          gtdList: 'scheduled',
          quadrant: 'q2', // Automate Parent Recall Card Categorization: routes to Q2 (Schedule)
          priority: ai?.priority || 'medium',
          dueDate: baseDateStr,
          scheduledDate: baseDateStr,
          recallGroupId,
          recallRole: 'parent',
          srsGroupId: recallGroupId,
          srsRole: 'parent',
          estimateMin,
          context: ['@computer'],
          tags: ai?.tags && ai.tags.length > 0 ? [...ai.tags, 'recall-parent'] : ['recall-parent'],
          projectId: null,
          areaId: null,
          waitingFor: null,
          subtasks: [],
          calendarEventId: null,
          order: 1000,
          completedAt: null,
          schemaVersion: 1,
        })

        // 2. Child 1: 1st Recall (24h)
        const date1 = format(addDays(baseDate, 1), 'yyyy-MM-dd')
        await repos.tasks.create({
          title: `1st Recall (24h): ${customTitle}`,
          notes: `1st Recall (24h spaced interval) for "${customTitle}". Revisit core concepts and verify recall.`,
          status: 'draft',
          gtdList: 'scheduled',
          quadrant: 'q2', // Rule 2: Explicitly assign quadrant: 'q2' (Schedule) by default
          priority: ai?.priority || 'medium',
          dueDate: date1,
          scheduledDate: date1,
          recallGroupId,
          recallRole: 'child',
          srsGroupId: recallGroupId,
          srsRole: 'child',
          estimateMin: 15,
          context: ['@computer'],
          tags: ['recall-review', '24h'],
          projectId: null,
          areaId: null,
          waitingFor: null,
          subtasks: [],
          calendarEventId: null,
          order: 1001,
          completedAt: null,
          schemaVersion: 1,
        })

        // 3. Child 2: 2nd Recall (2 weeks)
        const date2 = format(addDays(baseDate, 14), 'yyyy-MM-dd')
        await repos.tasks.create({
          title: `2nd Recall (2 weeks): ${customTitle}`,
          notes: `2nd Recall (2 weeks spaced interval) for "${customTitle}". Test retention and practical execution.`,
          status: 'draft',
          gtdList: 'scheduled',
          quadrant: 'q2', // Rule 2: Explicitly assign quadrant: 'q2' (Schedule) by default
          priority: ai?.priority || 'medium',
          dueDate: date2,
          scheduledDate: date2,
          recallGroupId,
          recallRole: 'child',
          srsGroupId: recallGroupId,
          srsRole: 'child',
          estimateMin: 20,
          context: ['@computer'],
          tags: ['recall-review', '2w'],
          projectId: null,
          areaId: null,
          waitingFor: null,
          subtasks: [],
          calendarEventId: null,
          order: 1002,
          completedAt: null,
          schemaVersion: 1,
        })

        // 4. Child 3: 3rd Recall (2 months)
        const date3 = format(addDays(baseDate, 60), 'yyyy-MM-dd')
        await repos.tasks.create({
          title: `3rd Recall (2 months): ${customTitle}`,
          notes: `3rd Recall (2 months spaced interval) for "${customTitle}". Verify long-term retention and mastery.`,
          status: 'draft',
          gtdList: 'scheduled',
          quadrant: 'q2', // Rule 2: Explicitly assign quadrant: 'q2' (Schedule) by default
          priority: ai?.priority || 'medium',
          dueDate: date3,
          scheduledDate: date3,
          recallGroupId,
          recallRole: 'child',
          srsGroupId: recallGroupId,
          srsRole: 'child',
          estimateMin: 30,
          context: ['@computer'],
          tags: ['recall-review', '2m'],
          projectId: null,
          areaId: null,
          waitingFor: null,
          subtasks: [],
          calendarEventId: null,
          order: 1003,
          completedAt: null,
          schemaVersion: 1,
        })

        // 5. Mark Inbox Item as processed
        const updatedInbox = await repos.inbox.update(inboxItem.id, {
          status: 'processed',
          processedAt: new Date().toISOString(),
          convertedTo: { type: 'task', id: parentTask.id },
        })

        return { task: parentTask, updatedInbox }
      }

      // Standard Non-Recall Task Creation
      const task = await repos.tasks.create({
        title: customTitle,
        notes: cleanNotes,
        status: 'draft',
        gtdList: effectiveDate ? 'scheduled' : gtdList,
        quadrant: null, // Normal tasks remain in "Uncategorized/Inbox" and "Draft" to grant the user manual sorting freedom
        priority: ai?.priority || 'medium',
        dueDate: effectiveDate,
        scheduledDate: effectiveDate,
        recallGroupId: null,
        recallRole: null,
        srsGroupId: null,
        srsRole: null,
        estimateMin,
        context: ['@computer'],
        tags: ai?.tags && ai.tags.length > 0 ? ai.tags : ['inbox-capture'],
        projectId: null,
        areaId: null,
        waitingFor: null,
        subtasks: [],
        calendarEventId: null,
        order: 1000,
        completedAt: null,
        schemaVersion: 1,
      })

      // Mark Inbox Item as processed
      const updatedInbox = await repos.inbox.update(inboxItem.id, {
        status: 'processed',
        processedAt: new Date().toISOString(),
        convertedTo: { type: 'task', id: task.id },
      })

      return { task, updatedInbox }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useDeleteInboxItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      return repos.inbox.update(id, { status: 'trashed' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY })
    },
  })
}
