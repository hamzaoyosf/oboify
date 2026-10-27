import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Task, Subscription } from '@/data/ports/schemas'
import { useTaskStore } from '@/app/store/taskStore'
import { useSubscriptions } from '@/features/capital/useSubscriptions'
import { formatMoney } from '@/lib/money'

export type Alert = {
  id: string
  type: string
  title: string
  subtitle: string
  date: string
  actionUrl: string
  isUrgent: boolean
  state?: 'action_needed' | 'upcoming_10min'
}

export type AlertScanner = () => Alert[]

/**
 * Returns current date formatted as local YYYY-MM-DD.
 * Strictly avoids UTC to prevent timezone off-by-one errors.
 */
export function getLocalTodayString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculates difference in minutes between Local Now and a given startTime.
 * Handles both "HH:mm" (local) and ISO-8601 string representations.
 */
export function getMinutesUntilStart(startTime: string): number {
  if (!startTime) return -999

  // If ISO string with T
  if (startTime.includes('T')) {
    const d = new Date(startTime)
    if (!isNaN(d.getTime())) {
      return Math.round((d.getTime() - Date.now()) / (60 * 1000))
    }
  }

  // If HH:mm or HH:mm:ss
  const parts = startTime.split(':').map(Number)
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const startMin = parts[0] * 60 + parts[1]
    return startMin - nowMin
  }

  return -999
}

/**
 * Smart Task Scanner (State Machine):
 * - Rule A (Overdue / Missed):
 *   IF (date < localTodayStr)
 *   OR (date === localTodayStr AND startTime is null/empty)
 *   OR (date === localTodayStr AND startTime exists BUT that time has already passed compared to local current time)
 *   THEN push an Overdue Alert to taskAlerts. (Title: "Overdue/Missed", Buttons: "Schedule" & "Focus Now").
 *
 * - Rule B (Upcoming - 10 Min Warning):
 *   IF (date === localTodayStr AND startTime exists AND the start time is strictly in the future BUT <= 10 minutes away)
 *   THEN push an Upcoming Alert to taskAlerts. (Title: "Starts in [diff] mins", Buttons: "Reschedule" & "Focus Now").
 *
 * - Rule C (Handled / Future Peace of Mind):
 *   IF (date === localTodayStr AND startTime exists AND start time is > 10 minutes in the future)
 *   THEN yields NO alerts.
 */
export function createTaskScanner(tasks: Task[]): Alert[] {
  const localTodayStr = getLocalTodayString()
  const taskAlerts: Alert[] = []

  for (const t of tasks) {
    if (t.status === 'done') continue
    const taskDate = (t.scheduledDate || t.dueDate)?.trim().split('T')[0]
    if (!taskDate) continue

    const hasStartTime = Boolean(t.startTime && t.startTime.trim().length > 0)
    const isPastDate = taskDate < localTodayStr
    const isToday = taskDate === localTodayStr

    // If scheduled for today with a startTime, calculate difference in minutes to local now
    const diff = hasStartTime ? getMinutesUntilStart(t.startTime!) : null
    const isTimePassed = diff !== null && diff <= 0
    const isUpcoming = diff !== null && diff > 0 && diff <= 10

    // Rule A (Overdue / Missed):
    // IF (date < localTodayStr)
    // OR (date === localTodayStr AND startTime is null/empty)
    // OR (date === localTodayStr AND startTime exists BUT that time has already passed compared to local current time)
    if (isPastDate || (isToday && !hasStartTime) || (isToday && hasStartTime && isTimePassed)) {
      const isOverdue = isPastDate
      const isMissed = isToday && hasStartTime && isTimePassed
      taskAlerts.push({
        id: t.id,
        type: 'task',
        title: 'Overdue/Missed',
        subtitle: isOverdue
          ? `${t.title} • Overdue (${taskDate})`
          : isMissed
          ? `${t.title} • Missed scheduled start (${t.startTime})`
          : `${t.title} • Due Today (${taskDate})`,
        date: taskDate,
        actionUrl: '/app/action',
        isUrgent: true,
        state: 'action_needed',
      })
      continue
    }

    // Rule B (Upcoming - 10 Min Warning):
    // IF (date === localTodayStr AND startTime exists AND the start time is strictly in the future BUT <= 10 minutes away)
    if (isToday && hasStartTime && isUpcoming) {
      taskAlerts.push({
        id: t.id,
        type: 'task',
        title: diff === 1 ? 'Starts in 1 min' : `Starts in ${diff} mins`,
        subtitle: t.title,
        date: taskDate,
        actionUrl: '/app/action',
        isUrgent: true,
        state: 'upcoming_10min',
      })
      continue
    }

    // Rule C (Future Handled): diff > 10 minutes in the future -> yields NO alerts (Peace of Mind)
  }

  return taskAlerts
}

/**
 * Multi-Stage Finance Scanner (Behavioral Psychology):
 * - Stage 1 (Silent Heads-up: 7 to 4 days): isUrgent = false. Quietly populates dropdown.
 * - Stage 2 (Active Warning: 3 to 0 days, or overdue): isUrgent = true. Triggers chime/toast and red badge.
 */
export function createFinanceScanner(subscriptions: Subscription[]): Alert[] {
  const localTodayStr = getLocalTodayString()
  const [tYear, tMonth, tDay] = localTodayStr.split('-').map(Number)
  const todayDate = new Date(tYear, tMonth - 1, tDay)

  return subscriptions
    .filter((sub) => sub.status === 'active' && sub.nextRenewal)
    .map((sub) => {
      const datePart = sub.nextRenewal.trim().split('T')[0]
      const parts = datePart.split('-').map(Number)
      if (parts.length !== 3) return null
      const [rYear, rMonth, rDay] = parts
      const renewalDate = new Date(rYear, rMonth - 1, rDay)

      const diffTime = renewalDate.getTime() - todayDate.getTime()
      const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24))

      // Only include subscriptions within the 7-day window (7 down to 0 days, or slightly overdue)
      if (daysUntil < -3 || daysUntil > 7) return null

      // Stage 1 (Silent Heads-up: 7 to 4 days) -> isUrgent = false
      // Stage 2 (Active Warning: 3 to 0 days, or overdue) -> isUrgent = true
      const isUrgent = daysUntil <= 3

      const formattedAmount = formatMoney(sub.amountMinor, sub.currency)
      const dayLabel =
        daysUntil === 0
          ? 'today'
          : daysUntil === 1
          ? 'in 1 day'
          : daysUntil < 0
          ? `(${Math.abs(daysUntil)} days overdue)`
          : `in ${daysUntil} days`

      const subtitle = `Cost: ${formattedAmount} ${dayLabel}`

      return {
        id: sub.id,
        type: 'finance',
        title: `${sub.name} Renews Soon`,
        subtitle,
        date: datePart,
        actionUrl: '/app/capital',
        isUrgent,
      } as Alert
    })
    .filter((alert): alert is Alert => alert !== null)
}

/**
 * Helper to advance a subscription's renewal date by its billing cycle.
 */
export function advanceRenewalDate(currentDateStr: string, cycle: string): string {
  try {
    const parts = currentDateStr.split('T')[0].split('-').map(Number)
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    if (cycle === 'yearly') {
      d.setFullYear(d.getFullYear() + 1)
    } else if (cycle === 'quarterly') {
      d.setMonth(d.getMonth() + 3)
    } else if (cycle === 'weekly') {
      d.setDate(d.getDate() + 7)
    } else {
      // default monthly
      d.setMonth(d.getMonth() + 1)
    }
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return currentDateStr
  }
}

/**
 * Module-level session memory tracking alerted IDs to prevent repeated audio/toast spam.
 */
export const notifiedSessionCache = new Set<string>()

/**
 * Helper to compute session cache key.
 * Distinguishes State A vs State B so transitioning to the 10-minute "Upcoming" window
 * triggers a fresh chime and toast even if previously alerted as overdue.
 */
export function getAlertCacheKey(alert: Alert): string {
  if (alert.type === 'task') {
    return alert.state ? `${alert.id}:${alert.state}` : `${alert.id}:${alert.title}`
  }
  return alert.id
}

/**
 * Native Web Audio soft chime (gentle sine wave ascending, no external files).
 */
export function playSoftChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12) // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.38)

    setTimeout(() => {
      try {
        ctx.close()
      } catch {
        // ignore
      }
    }, 500)
  } catch {
    // Autoplay policy or unsupported audio environment - fail silently
  }
}

/**
 * Dynamic, plugin-based Unified Notification Radar Hook.
 * Scans registered stores and presents unified alerts.
 */
export function useNotificationEngine() {
  const tasks = useTaskStore((s) => s.tasks)
  const { data: subscriptions = [] } = useSubscriptions('all')
  const [tick, setTick] = useState(0)

  // Re-scan periodically (every 15s) to detect 10-minute warning transitions and past scheduled times in real time
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1)
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  // Aggregate active alerts correctly: Task Overdue/Missed + Task Upcoming + Finance
  const activeAlerts = useMemo(() => {
    return [
      ...createTaskScanner(tasks),
      ...createFinanceScanner(subscriptions),
    ]
  }, [tasks, subscriptions, tick])

  // Audio & Toast notification loop
  useEffect(() => {
    // Pre-cache silent alerts immediately so they never trigger audio or toast
    activeAlerts.forEach((a) => {
      if (!a.isUrgent) {
        notifiedSessionCache.add(getAlertCacheKey(a))
      }
    })

    // Find any unnotified URGENT alerts
    const unnotifiedUrgent = activeAlerts.filter(
      (a) => a.isUrgent && !notifiedSessionCache.has(getAlertCacheKey(a))
    )

    if (unnotifiedUrgent.length > 0) {
      unnotifiedUrgent.forEach((a) => notifiedSessionCache.add(getAlertCacheKey(a)))
      playSoftChime()

      if (unnotifiedUrgent.length === 1) {
        toast.warning(unnotifiedUrgent[0].title, {
          description: unnotifiedUrgent[0].subtitle,
        })
      } else {
        toast.warning(`${unnotifiedUrgent.length} Urgent Alerts Pending`, {
          description:
            unnotifiedUrgent
              .map((a) => a.title)
              .slice(0, 3)
              .join(', ') + (unnotifiedUrgent.length > 3 ? '...' : ''),
        })
      }
    }
  }, [activeAlerts])

  return { activeAlerts }
}
