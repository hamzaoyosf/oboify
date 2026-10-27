import React, { useState } from 'react'
import {
  CalendarCheck,
  CheckCircle2,
  Inbox,
  ListTodo,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Target,
  Clock,
  Trash2,
  Check,
} from 'lucide-react'
import { useUIStore } from '@/app/store/uiStore'
import { useInbox, useConvertToTask, useDeleteInboxItem } from '@/features/inbox/useInbox'
import { useTasks, useUpdateTask } from '@/features/action/useTasks'
import { GTDList, Task, TaskStatus } from '@/data/ports/schemas'
import { cn } from '@/lib/utils'

export const WeeklyReviewWizard: React.FC = () => {
  const { isWeeklyReviewOpen, closeWeeklyReview } = useUIStore()
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  // Step 1: Inbox
  const { data: inboxItems = [] } = useInbox()
  const unprocessedItems = inboxItems.filter((i) => i.status === 'unprocessed')
  const convertTaskMutation = useConvertToTask()
  const deleteInboxMutation = useDeleteInboxItem()

  // Step 2: GTD Lists
  const { data: allTasks = [] } = useTasks()
  const updateTaskMutation = useUpdateTask()
  const [selectedGTDList, setSelectedGTDList] = useState<GTDList>('next')

  const activeGTDTasks = allTasks.filter(
    (t) => t.status !== 'done' && t.gtdList === selectedGTDList
  )

  // Step 3: Big Rocks / Focus
  const [bigRocks, setBigRocks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('oboify_weekly_big_rocks') || localStorage.getItem('kibanly_weekly_big_rocks')
      return saved ? JSON.parse(saved) : ['', '', '']
    } catch {
      return ['', '', '']
    }
  })
  const [isCompleted, setIsCompleted] = useState(false)

  if (!isWeeklyReviewOpen) return null

  const handleFinishReview = () => {
    localStorage.setItem('oboify_weekly_big_rocks', JSON.stringify(bigRocks))
    localStorage.setItem('oboify_last_weekly_review_at', new Date().toISOString())
    setIsCompleted(true)
    setTimeout(() => {
      setIsCompleted(false)
      setCurrentStep(1)
      closeWeeklyReview()
    }, 1500)
  }

  const handleToggleTaskStatus = (task: Task) => {
    const isDone = task.status === 'done'
    const nextStatus = (isDone ? (task.previousStatus || 'draft') : 'done') as TaskStatus
    updateTaskMutation.mutate({
      id: task.id,
      patch: {
        status: nextStatus,
        completedAt: nextStatus === 'done' ? new Date().toISOString() : null,
        previousStatus: !isDone ? task.status : null,
      },
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeWeeklyReview()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'w-full max-w-3xl card p-5 sm:p-6 border border-[rgba(255,255,255,0.14)]',
          'bg-surface/95 shadow-2xl flex flex-col max-h-[90vh]'
        )}
        data-hub="action"
      >
        {/* Wizard Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-xl bg-growth/15 text-growth border border-growth/30 shadow-sm">
              <CalendarCheck className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-text">
                  GTD Weekly Review Wizard
                </h2>
                <span className="font-mono text-[10px] text-text-muted px-2 py-0.5 rounded-chip bg-surface-2 border border-[rgba(255,255,255,0.06)]">
                  Step {currentStep} of 3
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Align commitments, clear your cognitive backlog, and calibrate for the upcoming week.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeWeeklyReview}
            className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-3 gap-2 py-3 border-b border-[rgba(255,255,255,0.04)]">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={cn(
              'flex items-center space-x-2 p-2 rounded-xl text-left transition-all',
              currentStep === 1
                ? 'bg-action/15 border border-action/30 text-action'
                : 'bg-surface-2/40 text-text-muted hover:bg-surface-2'
            )}
          >
            <Inbox className="w-4 h-4 shrink-0" />
            <div className="min-w-0 hidden sm:block">
              <p className="text-xs font-semibold truncate">1. Clear Inbox</p>
              <p className="text-[10px] text-text-faint truncate">
                {unprocessedItems.length} remaining
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className={cn(
              'flex items-center space-x-2 p-2 rounded-xl text-left transition-all',
              currentStep === 2
                ? 'bg-action/15 border border-action/30 text-action'
                : 'bg-surface-2/40 text-text-muted hover:bg-surface-2'
            )}
          >
            <ListTodo className="w-4 h-4 shrink-0" />
            <div className="min-w-0 hidden sm:block">
              <p className="text-xs font-semibold truncate">2. Review GTD</p>
              <p className="text-[10px] text-text-faint truncate">Next, Waiting, Someday</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep(3)}
            className={cn(
              'flex items-center space-x-2 p-2 rounded-xl text-left transition-all',
              currentStep === 3
                ? 'bg-action/15 border border-action/30 text-action'
                : 'bg-surface-2/40 text-text-muted hover:bg-surface-2'
            )}
          >
            <Target className="w-4 h-4 shrink-0" />
            <div className="min-w-0 hidden sm:block">
              <p className="text-xs font-semibold truncate">3. Plan Week</p>
              <p className="text-[10px] text-text-faint truncate">Top 3 Big Rocks</p>
            </div>
          </button>
        </div>

        {/* Wizard Step Content */}
        <div className="flex-1 overflow-y-auto py-4 min-h-[320px]">
          {isCompleted ? (
            /* Celebration Completion State */
            <div className="flex flex-col items-center justify-center h-full py-12 space-y-3 text-center">
              <div className="w-16 h-16 rounded-full bg-growth/20 border border-growth/40 flex items-center justify-center text-growth animate-bounce">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h3 className="text-xl font-bold text-text">Weekly Review Complete!</h3>
              <p className="text-sm text-text-muted max-w-md">
                Your brain is empty, your lists are clear, and your top priorities are locked in.
                Ready for peak execution.
              </p>
            </div>
          ) : currentStep === 1 ? (
            /* STEP 1: Clear the Inbox */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-mono uppercase tracking-wider text-text-muted font-semibold">
                  Unprocessed Captures ({unprocessedItems.length})
                </span>
                <span className="text-xs text-text-faint">
                  Convert each thought to a task or discard.
                </span>
              </div>

              {unprocessedItems.length === 0 ? (
                <div className="p-10 card text-center flex flex-col items-center justify-center space-y-2.5 border-dashed border-[rgba(255,255,255,0.1)]">
                  <div className="w-10 h-10 rounded-full bg-growth/15 text-growth flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-text">Inbox Zero Achieved</p>
                  <p className="text-xs text-text-muted">
                    No pending captures. You are ready to review your active GTD lists.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {unprocessedItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-surface-2/60 border border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-3 hover:border-border-strong transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text leading-snug">{item.text}</p>
                        {item.ai && (
                          <span className="mt-1 inline-flex items-center text-[10px] font-mono text-action uppercase tracking-wider">
                            ✨ {item.ai.category} • {item.ai.priority}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => convertTaskMutation.mutate(item)}
                          disabled={convertTaskMutation.isPending}
                          className="px-2.5 py-1.5 rounded-chip text-xs bg-action/20 text-action hover:bg-action hover:text-black transition-all flex items-center space-x-1"
                        >
                          <span>Convert</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteInboxMutation.mutate(item.id)}
                          disabled={deleteInboxMutation.isPending}
                          className="p-1.5 rounded-lg text-text-faint hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Discard capture"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : currentStep === 2 ? (
            /* STEP 2: Review GTD Lists */
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* GTD List Selector */}
                <div className="flex items-center space-x-1 p-1 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.06)]">
                  {(['next', 'waiting', 'someday'] as GTDList[]).map((list) => (
                    <button
                      key={list}
                      type="button"
                      onClick={() => setSelectedGTDList(list)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-mono uppercase font-semibold transition-all',
                        selectedGTDList === list
                          ? 'bg-action/20 text-action border border-action/30 shadow-sm'
                          : 'text-text-muted hover:text-text'
                      )}
                    >
                      {list}
                    </button>
                  ))}
                </div>

                <span className="text-xs text-text-faint font-mono">
                  {activeGTDTasks.length} active in {selectedGTDList.toUpperCase()}
                </span>
              </div>

              {activeGTDTasks.length === 0 ? (
                <div className="p-8 card text-center text-text-muted text-sm border-dashed border-[rgba(255,255,255,0.08)]">
                  No active tasks in {selectedGTDList.toUpperCase()} list.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {activeGTDTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl bg-surface-2/60 border border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleTaskStatus(task)}
                          className="w-4 h-4 rounded border border-border-strong flex items-center justify-center shrink-0 hover:border-action transition-colors"
                        >
                          {task.status === 'done' && <Check className="w-3 h-3 text-action" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-text truncate">{task.title}</p>
                          <div className="flex items-center space-x-2 text-[10px] font-mono text-text-faint mt-0.5">
                            <span className="capitalize">{task.priority}</span>
                            {task.dueDate && <span>• Due {task.dueDate}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Move to another GTD list quick select */}
                      <select
                        value={task.gtdList}
                        onChange={(e) =>
                          updateTaskMutation.mutate({
                            id: task.id,
                            patch: { gtdList: e.target.value as GTDList },
                          })
                        }
                        className="bg-surface text-text text-xs px-2 py-1 rounded-lg border border-[rgba(255,255,255,0.08)] focus:outline-none"
                      >
                        <option value="next">Next</option>
                        <option value="waiting">Waiting</option>
                        <option value="someday">Someday</option>
                        <option value="scheduled">Scheduled</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* STEP 3: Plan Upcoming Week & Big Rocks */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-growth/10 border border-growth/30 flex items-start space-x-3 text-xs">
                <Sparkles className="w-4 h-4 text-growth shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-growth">Declare Top 3 Big Rocks for the Week</p>
                  <p className="text-text-muted text-[11px] leading-relaxed">
                    Prioritize the 3 highest leverage outcomes that will move the needle across Action,
                    Growth, or Capital.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <span className="w-6 text-center font-mono text-xs font-bold text-growth">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={bigRocks[idx] || ''}
                      onChange={(e) => {
                        const copy = [...bigRocks]
                        copy[idx] = e.target.value
                        setBigRocks(copy)
                      }}
                      placeholder={`Major weekly objective #${idx + 1}...`}
                      className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-sm text-text focus:outline-none focus:border-growth/60"
                    />
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-surface-2/40 border border-[rgba(255,255,255,0.06)] flex items-center justify-between text-xs text-text-muted">
                <span className="flex items-center space-x-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5 text-action" />
                  <span>Time-blocking recommended in Action Hub timeline.</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="pt-3 border-t border-[rgba(255,255,255,0.08)] flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-chip text-xs text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => (prev + 1) as 2 | 3)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-chip text-xs font-semibold bg-action text-black hover:brightness-110 active:scale-95 transition-all shadow-md ml-auto"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishReview}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-chip text-xs font-bold bg-growth text-black hover:brightness-110 active:scale-95 transition-all shadow-lg ml-auto"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Complete Review</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
