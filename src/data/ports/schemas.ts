import { z } from 'zod'

/* -------------------------------------------------------------------------- */
/*                                 INBOX ITEM                                 */
/* -------------------------------------------------------------------------- */

export const InboxCategoryEnum = z.enum([
  'task',
  'note',
  'expense',
  'income',
  'event',
  'habit',
  'reference',
  'unknown',
])
export type InboxCategory = z.infer<typeof InboxCategoryEnum>

export const PriorityEnum = z.enum(['low', 'medium', 'high'])
export type Priority = z.infer<typeof PriorityEnum>

export const InboxStatusEnum = z.enum(['unprocessed', 'processed', 'trashed'])
export type InboxStatus = z.infer<typeof InboxStatusEnum>

export const EisenhowerQuadrantEnum = z
  .enum(['do', 'schedule', 'delegate', 'delete', 'q1', 'q2', 'q3', 'q4', 'uncategorized'])
  .nullable()
export type EisenhowerQuadrant = z.infer<typeof EisenhowerQuadrantEnum>

export const InboxContextEnum = z.enum(['Next Action', 'Waiting For', 'Scheduled', 'Someday'])
export type InboxContext = z.infer<typeof InboxContextEnum>

export const HubEnum = z.enum(['Action', 'Growth', 'Capital', 'Knowledge'])
export type Hub = z.infer<typeof HubEnum>

export const InboxAISchema = z.object({
  category: InboxCategoryEnum,
  priority: PriorityEnum,
  suggestedDue: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  model: z.string(),
  accepted: z.boolean().nullable().optional(),
  reasoning: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  suggestedQuadrant: EisenhowerQuadrantEnum.optional(),
  estimateMin: z.number().optional(),
  context: InboxContextEnum.optional(),
  hub: HubEnum.optional(),
  estimatedTime: z.string().optional(),
})
export type InboxAI = z.infer<typeof InboxAISchema>

export const InboxItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  source: z.string().default('quick_capture'),
  status: InboxStatusEnum.default('unprocessed'),
  ai: InboxAISchema.nullable().optional(),
  createdAt: z.string(),
  processedAt: z.string().nullable().optional(),
  convertedTo: z
    .object({
      type: z.string(),
      id: z.string(),
    })
    .nullable()
    .optional(),
  schemaVersion: z.number().default(1),
})
export type InboxItem = z.infer<typeof InboxItemSchema>

/* -------------------------------------------------------------------------- */
/*                                    TASK                                    */
/* -------------------------------------------------------------------------- */

export const TaskStatusEnum = z.enum(['draft', 'in_progress', 'done'])
export type TaskStatus = z.infer<typeof TaskStatusEnum>

export const GTDListEnum = z.enum([
  'next',
  'scheduled',
  'waiting',
  'someday',
  'next_action',
  'waiting_for',
])
export type GTDList = z.infer<typeof GTDListEnum>


export const SubtaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean().default(false),
})
export type Subtask = z.infer<typeof SubtaskSchema>

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  notes: z.string().optional().default(''),
  status: TaskStatusEnum.default('draft'),
  gtdList: GTDListEnum.default('next'),
  gtd: z.string().nullable().optional(),
  quadrant: EisenhowerQuadrantEnum.default(null),
  previousQuadrant: z.string().nullable().optional(),
  previousGtd: z.string().nullable().optional(),
  previousStatus: z.string().nullable().optional(),
  priority: PriorityEnum.default('medium'),
  dueDate: z.string().nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  isRecall: z.boolean().optional(),
  recallGroupId: z.string().nullable().optional(),
  recallRole: z.enum(['parent', 'child']).nullable().optional(),
  srsGroupId: z.string().nullable().optional(),
  srsRole: z.enum(['parent', 'child']).nullable().optional(),
  estimateMin: z.number().optional().default(0),
  context: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  projectId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  waitingFor: z.string().nullable().optional(),
  subtasks: z.array(SubtaskSchema).optional().default([]),
  calendarEventId: z.string().nullable().optional(),
  order: z.number().default(1000),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.number().default(1),
})
export type Task = z.infer<typeof TaskSchema> & {
  previousQuadrant?: string | null
  previousGtd?: string | null
  previousStatus?: string | null
  gtd?: string | null
}

/* -------------------------------------------------------------------------- */
/*                                 TIME BLOCK                                 */
/* -------------------------------------------------------------------------- */

export const TimeBlockCategoryEnum = z.enum([
  'deep_work',
  'admin',
  'meeting',
  'recovery',
  'learning',
  'personal',
  'external',
])
export type TimeBlockCategory = z.infer<typeof TimeBlockCategoryEnum>

export const TimeBlockSourceEnum = z.enum(['OBOiFY', 'KiBANLY', 'gcal'])
export type TimeBlockSource = z.infer<typeof TimeBlockSourceEnum>

export const GCalMetadataSchema = z.object({
  eventId: z.string(),
  etag: z.string().optional(),
  calendarId: z.string().default('primary'),
  lastSyncedAt: z.string().optional(),
})
export type GCalMetadata = z.infer<typeof GCalMetadataSchema>

export const TimeBlockSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  category: TimeBlockCategoryEnum.default('deep_work'),
  color: z.string().default('cyan'),
  start: z.string(), // ISO-8601 string
  end: z.string(),   // ISO-8601 string
  taskId: z.string().nullable().optional(),
  recallGroupId: z.string().nullable().optional(),
  srsGroupId: z.string().nullable().optional(),
  source: TimeBlockSourceEnum.default('OBOiFY'),
  gcal: GCalMetadataSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().default(() => new Date().toISOString()),
  schemaVersion: z.number().default(1),
})
export type TimeBlock = z.infer<typeof TimeBlockSchema>

/* -------------------------------------------------------------------------- */
/*                               HABIT & HABIT LOG                            */
/* -------------------------------------------------------------------------- */

export const HabitCategoryEnum = z.enum([
  'movement',
  'mindfulness',
  'nutrition',
  'sleep',
  'focus',
  'other',
])
export type HabitCategory = z.infer<typeof HabitCategoryEnum>

export const HabitFrequencyTypeEnum = z.enum([
  'daily',
  'weekdays',
  'x_per_week',
  'custom',
])
export type HabitFrequencyType = z.infer<typeof HabitFrequencyTypeEnum>

export const HabitFrequencySchema = z.object({
  type: HabitFrequencyTypeEnum.default('daily'),
  daysOfWeek: z.array(z.number()).optional(), // 0-6 (0 = Sunday, 1 = Monday, etc.)
  targetPerWeek: z.number().optional(),
})
export type HabitFrequency = z.infer<typeof HabitFrequencySchema>

export const HabitSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  icon: z.string().default('sparkles'),
  category: HabitCategoryEnum.default('other'),
  frequency: HabitFrequencySchema.default({ type: 'daily' }),
  targetPerWeek: z.number().default(7),
  archived: z.boolean().default(false),
  order: z.number().default(1000),
  createdAt: z.string(),
  updatedAt: z.string().default(() => new Date().toISOString()),
  schemaVersion: z.number().default(1),
})
export type Habit = z.infer<typeof HabitSchema>

export const HabitLogSchema = z.object({
  id: z.string(), // deterministic: ${habitId}_${YYYY-MM-DD}
  habitId: z.string(),
  date: z.string(), // YYYY-MM-DD
  done: z.boolean(),
  note: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().default(() => new Date().toISOString()),
  schemaVersion: z.number().default(1),
})
export type HabitLog = z.infer<typeof HabitLogSchema>

/* -------------------------------------------------------------------------- */
/*                                 ENERGY LOG                                 */
/* -------------------------------------------------------------------------- */

export const EnergyLogSchema = z.object({
  id: z.string(), // deterministic: YYYY-MM-DD
  date: z.string(), // YYYY-MM-DD
  energy: z.number().min(1).max(5),
  focus: z.number().min(1).max(5),
  mood: z.number().min(1).max(5),
  sleepHours: z.number().min(0).max(24),
  workoutDone: z.boolean().default(false),
  tasksCompleted: z.number().default(0),
  deepWorkMin: z.number().default(0),
  note: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().default(() => new Date().toISOString()),
  schemaVersion: z.number().default(1),
})
export type EnergyLog = z.infer<typeof EnergyLogSchema>

/* -------------------------------------------------------------------------- */
/*                        CAPITAL HUB: TRANSACTIONS & LEDGER                  */
/* -------------------------------------------------------------------------- */

export const TransactionScopeEnum = z.enum(['business', 'personal'])
export type TransactionScope = z.infer<typeof TransactionScopeEnum>

export const TransactionTypeEnum = z.enum(['income', 'expense'])
export type TransactionType = z.infer<typeof TransactionTypeEnum>

export const TransactionSchema = z.object({
  id: z.string(), // txn_...
  type: TransactionTypeEnum,
  scope: TransactionScopeEnum.default('business'),
  amountMinor: z.number().int().min(0), // Integer minor units (e.g. cents) per SRS FR-CAP-01
  currency: z.string().default('USD'),
  category: z.string().default('general'),
  description: z.string().min(1),
  date: z.string(), // YYYY-MM-DD
  subscriptionId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().default(() => new Date().toISOString()),
  schemaVersion: z.number().default(1),
})
export type Transaction = z.infer<typeof TransactionSchema>

/* -------------------------------------------------------------------------- */
/*                                SUBSCRIPTIONS                               */
/* -------------------------------------------------------------------------- */

export const SubscriptionCycleEnum = z.enum(['weekly', 'monthly', 'quarterly', 'yearly'])
export type SubscriptionCycle = z.infer<typeof SubscriptionCycleEnum>

export const SubscriptionStatusEnum = z.enum(['active', 'paused', 'canceled'])
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusEnum>

export const SubscriptionSchema = z.object({
  id: z.string(), // sub_...
  name: z.string().min(1),
  amountMinor: z.number().int().min(0), // In minor units (cents)
  currency: z.string().default('USD'),
  cycle: SubscriptionCycleEnum.default('monthly'),
  nextRenewal: z.string(), // YYYY-MM-DD
  scope: TransactionScopeEnum.default('business'),
  category: z.string().default('dev_tools'),
  status: SubscriptionStatusEnum.default('active'),
  remindDaysBefore: z.number().default(3),
  url: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().default(() => new Date().toISOString()),
  schemaVersion: z.number().default(1),
})
export type Subscription = z.infer<typeof SubscriptionSchema>

/* -------------------------------------------------------------------------- */
/*                                 MILESTONES                                 */
/* -------------------------------------------------------------------------- */

export const MilestoneSchema = z.object({
  id: z.string(), // ms_...
  name: z.string().min(1),
  targetMinor: z.number().int().min(1),
  currentMinor: z.number().int().min(0),
  monthlyContributionMinor: z.number().int().min(0),
  currency: z.string().default('USD'),
  targetDate: z.string().nullable().optional(),
  scope: TransactionScopeEnum.default('personal'),
  createdAt: z.string(),
  updatedAt: z.string().default(() => new Date().toISOString()),
  schemaVersion: z.number().default(1),
})
export type Milestone = z.infer<typeof MilestoneSchema>

/* -------------------------------------------------------------------------- */
/*                       KNOWLEDGE HUB: NOTES & ZETTELKASTEN                  */
/* -------------------------------------------------------------------------- */

export const NoteTypeEnum = z.enum(['fleeting', 'literature', 'permanent'])
export type NoteType = z.infer<typeof NoteTypeEnum>

export const NoteSchema = z.object({
  id: z.string(), // not_...
  title: z.string().min(1),
  content: z.string().default(''), // Markdown content
  type: NoteTypeEnum.default('fleeting'),
  tags: z.array(z.string()).default([]),
  linkedNoteIds: z.array(z.string()).default([]), // Bi-directional Zettelkasten links
  resourceId: z.string().nullable().optional(), // Linked source resource
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string().default(() => new Date().toISOString()),
  schemaVersion: z.number().default(1),
})
export type Note = z.infer<typeof NoteSchema>

/* -------------------------------------------------------------------------- */
/*                                  RESOURCES                                 */
/* -------------------------------------------------------------------------- */

export const ResourceTypeEnum = z.enum([
  'article',
  'book',
  'paper',
  'podcast',
  'video',
  'other',
])
export type ResourceType = z.infer<typeof ResourceTypeEnum>

export const ResourceStatusEnum = z.enum([
  'to_read',
  'reading',
  'completed',
  'abandoned',
])
export type ResourceStatus = z.infer<typeof ResourceStatusEnum>

export const ResourceSchema = z.object({
  id: z.string(), // res_...
  title: z.string().min(1),
  url: z.string().nullable().optional(),
  type: ResourceTypeEnum.default('article'),
  author: z.string().nullable().optional(),
  status: ResourceStatusEnum.default('to_read'),
  rating: z.number().min(1).max(5).nullable().optional(),
  summary: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string().default(() => new Date().toISOString()),
  schemaVersion: z.number().default(1),
})
export type Resource = z.infer<typeof ResourceSchema>

/* -------------------------------------------------------------------------- */
/*                                    TAGS                                    */
/* -------------------------------------------------------------------------- */

export const TagSchema = z.object({
  id: z.string(), // tag_...
  name: z.string().min(1),
  color: z.string().default('violet'),
  createdAt: z.string(),
  schemaVersion: z.number().default(1),
})
export type Tag = z.infer<typeof TagSchema>

