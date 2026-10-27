import React, { useState, useEffect, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  HOUR_HEIGHT_IN_PIXELS,
  SLOT_HEIGHT_IN_PIXELS,
  TOTAL_HOURS,
  TOTAL_TIMELINE_HEIGHT,
  PositionedTimeBlock,
} from './layoutBlocks'
import { TimeBlockCard } from './TimeBlockCard'
import { Task, TimeBlock } from '@/data/ports/schemas'
import { cn } from '@/lib/utils'

interface TimeGridProps {
  selectedDate: string // YYYY-MM-DD
  positionedBlocks: PositionedTimeBlock[]
  onDeleteBlock: (id: string) => void
  onEditBlock?: (block: TimeBlock) => void
  isDraggingActive?: boolean
  recallTaskIds?: Set<string>
  srsTaskIds?: Set<string>
  allTasks?: Task[]
  scrollToNowTrigger?: number
}

interface SlotProps {
  hour: number
  minute: number
}

const Droppable15MinSlot: React.FC<SlotProps> = ({ hour, minute }) => {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const timeStr = `${pad(hour)}:${pad(minute)}`
  const slotId = `slot-${timeStr}`

  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
    data: {
      type: 'timeline-slot',
      time: timeStr,
      hour,
      minute,
    },
  })

  return (
    <div
      ref={setNodeRef}
      id={slotId}
      data-time={timeStr}
      style={{
        height: `${SLOT_HEIGHT_IN_PIXELS}px`,
        zIndex: 10,
        pointerEvents: 'auto',
      }}
      className={cn(
        'w-full border-b transition-colors select-none relative',
        minute === 45
          ? 'border-b-[rgba(255,255,255,0.08)]'
          : 'border-b-[rgba(255,255,255,0.025)]',
        isOver && 'bg-action/30 border-action/60 ring-2 ring-inset ring-action/60 z-20'
      )}
    />
  )
}

export const TimeGrid: React.FC<TimeGridProps> = ({
  selectedDate,
  positionedBlocks,
  onDeleteBlock,
  onEditBlock,
  isDraggingActive = false,
  recallTaskIds,
  srsTaskIds,
  allTasks,
  scrollToNowTrigger,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date())
  const timelineContainerRef = useRef<HTMLDivElement>(null)
  const currentTimeRef = useRef<HTMLDivElement>(null)

  // Update current time every 30 seconds for the "now" indicator line
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i)

  // EXACT FORMULA: const topOffset = (hours + minutes / 60) * HOUR_HEIGHT_IN_PIXELS;
  const todayStr = currentTime.toISOString().slice(0, 10)
  const localTodayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`
  const isToday = selectedDate === todayStr || selectedDate === localTodayStr

  const nowHours = currentTime.getHours()
  const nowMinutes = currentTime.getMinutes()
  const nowTopPx = (nowHours + nowMinutes / 60) * HOUR_HEIGHT_IN_PIXELS
  const isNowVisible = isToday && nowTopPx >= 0 && nowTopPx <= TOTAL_TIMELINE_HEIGHT

  const nowFormatted = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  // Localized Auto-Scroll for the Timeline (centers red line in container without window scrolling)
  useEffect(() => {
    if (isNowVisible) {
      const scrollToNow = () => {
        const container = timelineContainerRef.current
        const indicator = currentTimeRef.current
        if (container && indicator) {
          // Calculate the position to center the red line inside the container
          const scrollPosition =
            indicator.offsetTop - container.clientHeight / 2 + indicator.clientHeight / 2
          container.scrollTo({ top: scrollPosition, behavior: 'smooth' })
        }
      }

      scrollToNow()
      const timer = setTimeout(scrollToNow, 50)
      return () => clearTimeout(timer)
    }
  }, [isNowVisible, selectedDate, scrollToNowTrigger])

  return (
    <div
      ref={timelineContainerRef}
      className="relative card p-4 bg-surface/50 border border-[rgba(255,255,255,0.06)] h-full overflow-y-auto overflow-x-hidden"
    >
      <div className="flex">
        {/* Hour Axis Labels (00:00 to 23:00) with absolute positioning centered on grid lines */}
        <div
          style={{ height: `${TOTAL_TIMELINE_HEIGHT}px` }}
          className="w-14 sm:w-16 shrink-0 relative select-none pr-3"
        >
          {hours.map((hour) => {
            const label = `${hour.toString().padStart(2, '0')}:00`
            const topPx = hour * HOUR_HEIGHT_IN_PIXELS
            return (
              <div
                key={hour}
                style={{ top: `${topPx}px` }}
                className="absolute right-3 -translate-y-1/2 font-mono text-[11px] text-text-faint"
              >
                {label}
              </div>
            )
          })}
        </div>

        {/* Schedule Grid Area (24 Hours = 2304px) */}
        <div
          style={{ height: `${TOTAL_TIMELINE_HEIGHT}px` }}
          className="flex-1 relative border-l border-[rgba(255,255,255,0.06)]"
        >
          {/* Work-hours background highlight (09:00 - 17:00) */}
          <div
            style={{
              top: `${9 * HOUR_HEIGHT_IN_PIXELS}px`,
              height: `${8 * HOUR_HEIGHT_IN_PIXELS}px`,
            }}
            className="absolute inset-x-0 bg-surface-2/20 pointer-events-none"
          />

          {/* 24 Hour Rows, each containing four 15-Minute Droppable Slots */}
          {hours.map((hour) => (
            <div
              key={hour}
              style={{ height: `${HOUR_HEIGHT_IN_PIXELS}px` }}
              className="relative flex flex-col"
            >
              <Droppable15MinSlot hour={hour} minute={0} />
              <Droppable15MinSlot hour={hour} minute={15} />
              <Droppable15MinSlot hour={hour} minute={30} />
              <Droppable15MinSlot hour={hour} minute={45} />
            </div>
          ))}

          {/* Rendered Time Blocks Layer */}
          <div
            className={cn(
              'absolute inset-0',
              isDraggingActive ? 'pointer-events-none z-0' : 'pointer-events-none z-15'
            )}
          >
            {positionedBlocks.map((pos) => (
              <TimeBlockCard
                key={pos.block.id + (pos.isCrossOver ? '-crossover' : '')}
                positioned={pos}
                onDelete={onDeleteBlock}
                onEdit={onEditBlock}
                isDropTargetBlocked={isDraggingActive}
                isRecall={Boolean(
                  pos.block.recallGroupId ||
                    pos.block.srsGroupId ||
                    (pos.block.taskId && (recallTaskIds?.has(pos.block.taskId) || srsTaskIds?.has(pos.block.taskId)))
                )}
                allTasks={allTasks}
              />
            ))}
          </div>

          {/* Red "Now" Indicator Line (Exact pixel coordinate) */}
          {isNowVisible && (
            <div
              ref={currentTimeRef}
              style={{ top: `${nowTopPx}px` }}
              className="absolute inset-x-0 z-30 flex items-center pointer-events-none -mt-[1px]"
            >
              {/* Pulsing indicator dot */}
              <div className="relative -ml-1.5 flex h-3 w-3 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
              </div>

              {/* Red line */}
              <div className="flex-1 border-t-2 border-danger shadow-[0_0_8px_rgba(251,113,133,0.5)]" />

              {/* Time tag */}
              <span className="ml-1 font-mono text-[10px] text-danger font-semibold bg-bg-elevated px-1 py-0.2 rounded border border-danger/30">
                {nowFormatted}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
