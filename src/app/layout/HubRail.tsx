import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
  Zap,
  TrendingUp,
  Coins,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from 'lucide-react'
import { useUIStore } from '@/app/store/uiStore'
import { useTasks } from '@/features/action/useTasks'
import { AuthPill } from '@/features/auth/components/AuthPill'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  to: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  hub?: 'action' | 'growth' | 'capital' | 'knowledge'
}

const mainNavItems: NavItem[] = [
  { name: 'Dashboard', to: '/app', icon: LayoutDashboard },
  { name: 'Inbox', to: '/app/inbox', icon: Inbox },
  { name: 'Action', to: '/app/action', icon: Zap, hub: 'action' },
  { name: 'Growth', to: '/app/growth', icon: TrendingUp, hub: 'growth' },
  { name: 'Capital', to: '/app/capital', icon: Coins, hub: 'capital' },
  { name: 'Knowledge', to: '/app/knowledge', icon: BookOpen, hub: 'knowledge' },
]

export const HubRail: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false)
  const { openQuickCapture, openCommandPalette } = useUIStore()

  // Sync tasks with repository/backend
  useTasks()

  return (
    <>
      {/* Desktop Left Rail (>= md) */}
      <aside
        className={cn(
          'hidden md:flex flex-col justify-between shrink-0 h-screen sticky top-0 z-30',
          'bg-bg-elevated border-r border-border transition-all duration-200 ease-out',
          isExpanded ? 'w-[240px]' : 'w-[72px]'
        )}
        aria-label="Sidebar Navigation"
      >
        {/* Top Header / App Brand */}
        <div className="flex flex-col">
          <div
            className={cn(
              'h-16 flex items-center border-b border-border px-4',
              isExpanded ? 'justify-between' : 'justify-center'
            )}
          >
            {isExpanded ? (
              <NavLink to="/app" className="flex items-center">
                <span className="font-mono text-sm font-semibold tracking-wider text-text">
                  OBOiFY
                </span>
              </NavLink>
            ) : (
              <NavLink to="/app" className="font-mono text-xs font-bold text-text hover:text-emerald-400 transition-colors">
                O
              </NavLink>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
              title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isExpanded ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Quick Capture Button (Desktop) - Flat Emerald Semantic */}
          <div className="p-2 border-b border-border">
            <button
              type="button"
              onClick={openQuickCapture}
              className={cn(
                'w-full flex items-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all shadow-sm hover:shadow active:scale-95',
                isExpanded
                  ? 'h-10 px-3 justify-between text-xs'
                  : 'h-10 justify-center'
              )}
              title="Quick Capture (Q)"
            >
              <div className="flex items-center space-x-2">
                <Plus className="w-4 h-4 stroke-[2.5]" />
                {isExpanded && <span>Quick Capture</span>}
              </div>
              {isExpanded && (
                <kbd className="px-1.5 py-0.5 rounded bg-black/30 text-white/90 font-mono text-[10px]">
                  Q
                </kbd>
              )}
            </button>

            {/* Command Palette Trigger */}
            <button
              type="button"
              onClick={openCommandPalette}
              className={cn(
                'w-full mt-1.5 flex items-center rounded-lg bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-2 hover:border-gray-600 transition-all active:scale-95 text-xs',
                isExpanded ? 'h-9 px-3 justify-between' : 'h-9 justify-center'
              )}
              title="Search Command Palette (Cmd+K)"
            >
              <div className="flex items-center space-x-2">
                <Search className="w-3.5 h-3.5 text-text-muted" />
                {isExpanded && <span>Search...</span>}
              </div>
              {isExpanded && (
                <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border font-mono text-[9px] text-text-faint">
                  ⌘K
                </kbd>
              )}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-2 space-y-1" aria-label="Main Navigation">
            {mainNavItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/app'}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center h-10 px-3 rounded-lg transition-all duration-150',
                      isActive
                        ? 'bg-surface-2 text-text font-medium border-l-2 border-emerald-500 shadow-sm'
                        : 'text-text-muted hover:text-text hover:bg-surface'
                    )
                  }
                  title={!isExpanded ? item.name : undefined}
                >
                  <span className="flex items-center justify-center shrink-0 w-5 h-5 text-text-muted group-hover:text-text">
                    <Icon className="w-4 h-4 transition-transform group-hover:scale-105" />
                  </span>

                  {isExpanded && (
                    <span className="ml-3 text-sm truncate">{item.name}</span>
                  )}
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Footer / Notifications, Settings & Cloud Auth */}
        <div className="p-2 border-t border-border space-y-1.5">
          <div className="flex items-center justify-center">
            <NotificationBell
              placement={isExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}
            />
          </div>

          <div className="flex items-center justify-center">
            <AuthPill placement="sidebar" />
          </div>

          <NavLink
            to="/app/settings"
            className={({ isActive }) =>
              cn(
                'group flex items-center h-10 px-3 rounded-lg transition-all duration-150',
                isActive
                  ? 'bg-surface-2 text-text font-medium border-l-2 border-emerald-500 shadow-sm'
                  : 'text-text-muted hover:text-text hover:bg-surface'
              )
            }
            title={!isExpanded ? 'Settings' : undefined}
          >
            <span className="flex items-center justify-center shrink-0 w-5 h-5 text-text-muted group-hover:text-text">
              <Settings className="w-4 h-4 transition-transform group-hover:rotate-45" />
            </span>
            {isExpanded && <span className="ml-3 text-sm truncate">Settings</span>}
          </NavLink>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar (< md) - Flat Minimalist */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border z-40 px-2 flex items-center justify-around"
        aria-label="Mobile Navigation"
      >
        <NavLink
          to="/app"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center p-1 transition-colors',
              isActive ? 'text-emerald-400 font-semibold' : 'text-text-muted hover:text-text'
            )
          }
          aria-label="Dashboard"
          title="Dashboard"
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="text-[9px] font-mono mt-0.5">Deck</span>
        </NavLink>

        <NavLink
          to="/app/action"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center p-1 transition-colors',
              isActive ? 'text-emerald-400 font-semibold' : 'text-text-muted hover:text-text'
            )
          }
          aria-label="Action"
          title="Action"
        >
          <Zap className="w-4 h-4" />
          <span className="text-[9px] font-mono mt-0.5">Action</span>
        </NavLink>

        <NavLink
          to="/app/growth"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center p-1 transition-colors',
              isActive ? 'text-emerald-400 font-semibold' : 'text-text-muted hover:text-text'
            )
          }
          aria-label="Growth"
          title="Growth"
        >
          <TrendingUp className="w-4 h-4" />
          <span className="text-[9px] font-mono mt-0.5">Growth</span>
        </NavLink>

        {/* Central Quick Capture FAB - Flat Emerald */}
        <div className="-mt-5 flex items-center justify-center">
          <button
            type="button"
            onClick={openQuickCapture}
            className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
            aria-label="Quick Capture"
            title="Quick Capture (Q)"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        <NavLink
          to="/app/capital"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center p-1 transition-colors',
              isActive ? 'text-emerald-400 font-semibold' : 'text-text-muted hover:text-text'
            )
          }
          aria-label="Capital"
          title="Capital"
        >
          <Coins className="w-4 h-4" />
          <span className="text-[9px] font-mono mt-0.5">Capital</span>
        </NavLink>

        <NavLink
          to="/app/knowledge"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center p-1 transition-colors',
              isActive ? 'text-emerald-400 font-semibold' : 'text-text-muted hover:text-text'
            )
          }
          aria-label="Knowledge"
          title="Knowledge"
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-[9px] font-mono mt-0.5">Vault</span>
        </NavLink>

        <NavLink
          to="/app/inbox"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center p-1 transition-colors',
              isActive ? 'text-emerald-400 font-semibold' : 'text-text-muted hover:text-text'
            )
          }
          aria-label="Inbox"
          title="Inbox"
        >
          <Inbox className="w-4 h-4" />
          <span className="text-[9px] font-mono mt-0.5">Inbox</span>
        </NavLink>
      </nav>
    </>
  )
}
