import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCircle2, AlertTriangle, CreditCard, X } from 'lucide-react'
import { toast } from 'sonner'
import { useNotificationEngine, Alert, advanceRenewalDate } from './useNotificationEngine'
import { useSubscriptions, useUpdateSubscription } from '@/features/capital/useSubscriptions'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  placement?: 'sidebar-expanded' | 'sidebar-collapsed' | 'header'
  align?: 'left' | 'right'
  className?: string
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  placement = 'sidebar-collapsed',
  align = 'left',
  className,
}) => {
  const { activeAlerts } = useNotificationEngine()
  const { data: subscriptions = [] } = useSubscriptions('all')
  const updateSubMutation = useUpdateSubscription()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()

  // Urgent alerts trigger the red badge (Tasks & 3-0 day active financial warnings)
  const urgentAlerts = useMemo(
    () => activeAlerts.filter((a) => a.isUrgent),
    [activeAlerts]
  )
  const urgentCount = urgentAlerts.length

  // Handle outside clicks and ESC key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMarkPaid = async (alert: Alert) => {
    const sub = subscriptions.find((s) => s.id === alert.id)
    if (!sub) return
    const nextRenewal = advanceRenewalDate(sub.nextRenewal, sub.cycle)
    try {
      await updateSubMutation.mutateAsync({
        id: sub.id,
        patch: { nextRenewal, updatedAt: new Date().toISOString() },
      })
      toast.success(`Marked ${sub.name} as paid`, {
        description: `Next renewal advanced to ${nextRenewal}`,
      })
    } catch {
      toast.error('Failed to update subscription')
    }
  }

  const isExpandedSidebar = placement === 'sidebar-expanded'
  const isHeader = placement === 'header'

  const popoverPositionClass = isHeader
    ? align === 'left'
      ? 'top-full left-0 mt-2'
      : 'top-full right-0 mt-2'
    : 'left-full ml-3 bottom-0'

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      {isExpandedSidebar ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'group flex items-center w-full h-10 px-3 rounded-lg transition-all duration-150',
            isOpen
              ? 'bg-surface-2 text-text font-medium border-l-2 border-red-500 shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-surface'
          )}
          aria-label={`Notifications (${activeAlerts.length} active, ${urgentCount} urgent)`}
          title={
            urgentCount > 0
              ? `${urgentCount} urgent alerts`
              : activeAlerts.length > 0
              ? `${activeAlerts.length} heads-up alerts`
              : 'Notifications'
          }
        >
          <span className="relative flex items-center justify-center shrink-0 w-5 h-5 text-text-muted group-hover:text-text">
            <Bell className="w-4 h-4 transition-transform group-hover:scale-105" />
            {urgentCount > 0 && (
              <span
                data-testid="notification-badge"
                className="bg-red-500 text-white rounded-full absolute -top-1 -right-1 text-[10px] w-4 h-4 flex items-center justify-center font-bold shadow-sm pointer-events-none"
              >
                {urgentCount > 99 ? '99+' : urgentCount}
              </span>
            )}
          </span>
          <span className="ml-3 text-sm truncate">Alerts</span>
          {urgentCount > 0 ? (
            <span className="ml-auto px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-mono font-bold">
              {urgentCount}
            </span>
          ) : activeAlerts.length > 0 ? (
            <span className="ml-auto px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold">
              {activeAlerts.length}
            </span>
          ) : null}
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'relative p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500/50',
            isOpen && 'bg-surface-2 text-text'
          )}
          aria-label={`Notifications (${activeAlerts.length} active, ${urgentCount} urgent)`}
          title={
            urgentCount > 0
              ? `${urgentCount} urgent alerts`
              : activeAlerts.length > 0
              ? `${activeAlerts.length} heads-up alerts`
              : 'Notifications'
          }
        >
          <Bell className="w-4 h-4" />
          {urgentCount > 0 && (
            <span
              data-testid="notification-badge"
              className="bg-red-500 text-white rounded-full absolute -top-1 -right-1 text-[10px] w-4 h-4 flex items-center justify-center font-bold shadow-sm pointer-events-none"
            >
              {urgentCount > 99 ? '99+' : urgentCount}
            </span>
          )}
        </button>
      )}

      {/* Unified Notification Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute w-80 sm:w-88 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md',
            popoverPositionClass
          )}
          role="dialog"
          aria-label="Notification Radar"
        >
          {/* Header */}
          <div className="p-3 border-b border-border flex items-center justify-between bg-surface-2/40">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-text uppercase tracking-wider font-mono">
                Unified Radar
              </span>
              {urgentCount > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-mono font-bold">
                  {urgentCount} Urgent
                </span>
              ) : activeAlerts.length > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold">
                  {activeAlerts.length} Heads-up
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-medium">
                  Clean
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Alert List / Empty State */}
          <div className="max-h-80 overflow-y-auto">
            {activeAlerts.length === 0 ? (
              <div className="p-6 text-center text-text-muted">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2 opacity-80" />
                <p className="text-sm font-medium text-text">Mind Clear - No active alerts.</p>
                <p className="text-xs text-text-muted mt-1 font-mono">
                  All tasks are currently on track.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {activeAlerts.map((alert) => {
                  const isUrgent = alert.isUrgent
                  const isFinance = alert.type === 'finance'

                  return (
                    <div
                      key={`${alert.type}-${alert.id}-${alert.title}`}
                      className={cn(
                        'p-3 border-l-2 transition-colors space-y-2',
                        isUrgent
                          ? 'border-l-red-500 bg-red-500/5 hover:bg-red-500/10'
                          : 'border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5">
                            {isFinance ? (
                              <CreditCard
                                className={cn(
                                  'w-3.5 h-3.5 shrink-0',
                                  isUrgent ? 'text-red-400' : 'text-amber-400'
                                )}
                              />
                            ) : (
                              <AlertTriangle
                                className={cn(
                                  'w-3.5 h-3.5 shrink-0',
                                  isUrgent ? 'text-red-400' : 'text-amber-400'
                                )}
                              />
                            )}
                            <p className="text-xs font-semibold text-text truncate">
                              {alert.title}
                            </p>
                          </div>
                          <p
                            className={cn(
                              'text-[11px] font-mono mt-0.5 ml-5',
                              isUrgent ? 'text-red-400' : 'text-amber-400'
                            )}
                          >
                            {alert.subtitle}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase',
                            isUrgent
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          )}
                        >
                          {isUrgent ? 'Urgent' : 'Heads-up'}
                        </span>
                      </div>

                      {/* Task Action Controls */}
                      {alert.type === 'task' && (
                        <div className="flex items-center justify-end space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false)
                              navigate(`/app/action?view=timeline&highlight=${alert.id}`)
                            }}
                            className="px-2.5 py-1 text-[11px] font-mono rounded bg-surface border border-border text-text hover:bg-surface-2 transition-colors"
                          >
                            {alert.state === 'upcoming_10min' ? 'Reschedule' : 'Schedule'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false)
                              navigate(`/app/action?focus=${alert.id}`)
                            }}
                            className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors"
                          >
                            Focus Now
                          </button>
                        </div>
                      )}

                      {/* Finance Action Controls */}
                      {isFinance && (
                        <div className="flex items-center justify-end space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false)
                              navigate('/app/capital')
                            }}
                            className="px-2.5 py-1 text-[11px] font-mono rounded bg-surface border border-border text-text hover:bg-surface-2 transition-colors"
                          >
                            Review Capital Hub
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(alert)}
                            className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                          >
                            Mark Paid
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
