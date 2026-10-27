import {
  Task as SchemaTask,
  Priority,
  TaskStatus,
  GTDList,
  EisenhowerQuadrant,
  Subtask,
  TimeBlock,
  TimeBlockCategory,
} from './data/ports/schemas'

export type {
  Priority,
  TaskStatus,
  GTDList,
  EisenhowerQuadrant,
  Subtask,
  TimeBlock,
  TimeBlockCategory,
}

export interface Task extends SchemaTask {
  previousQuadrant?: string | null
  previousGtd?: string | null
  previousStatus?: string | null
  gtd?: string | null
}
