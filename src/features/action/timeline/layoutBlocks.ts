import { TimeBlock } from '@/data/ports/schemas'
import { getPreviousDateStr, getBlockDateKey } from '../useTimeBlocks'

export const HOUR_HEIGHT_IN_PIXELS = 96
export const SLOT_HEIGHT_IN_PIXELS = 24 // 4 slots of 15 min per hour (96 / 4 = 24)
export const TOTAL_HOURS = 24
export const TOTAL_TIMELINE_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT_IN_PIXELS // 2304px

export interface PositionedTimeBlock {
  block: TimeBlock
  topPx: number
  heightPx: number
  leftPct: number
  widthPct: number
  isCrossOver?: boolean
}

function getMinutesFromMidnight(isoString: string): { hours: number; minutes: number; totalMinutes: number } {
  const d = new Date(isoString)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  return {
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes,
  }
}

/**
 * Snaps a date to the nearest 15-minute mark (FR-TIM-01).
 */
export function snapTo15Minutes(date: Date): Date {
  const ms = 1000 * 60 * 15
  return new Date(Math.round(date.getTime() / ms) * ms)
}

/**
 * Layout algorithm implementing FR-TIM-02 with exact pixel math:
 * const topOffset = (hours + minutes / 60) * HOUR_HEIGHT_IN_PIXELS;
 * Maps start/end times precisely to the 24-hour grid.
 * Supports cross-day overflow from yesterday rendering at 00:00 with remainder duration.
 */
export function layoutTimeBlocks(blocks: TimeBlock[], selectedDate?: string): PositionedTimeBlock[] {
  if (blocks.length === 0) return []

  const yesterdayDateStr = selectedDate ? getPreviousDateStr(selectedDate) : undefined

  // 1. Convert to minutes representation
  const items = blocks.map((block) => {
    const blockDate = getBlockDateKey(block.start)
    const isCrossOverFromYesterday = Boolean(
      selectedDate &&
        yesterdayDateStr &&
        (blockDate === yesterdayDateStr || block.start.startsWith(yesterdayDateStr))
    )

    let startInfo: { hours: number; minutes: number; totalMinutes: number }
    let endInfo: { hours: number; minutes: number; totalMinutes: number }

    if (isCrossOverFromYesterday) {
      // Cross-over from yesterday: starts at 00:00 on today's grid with remainder duration
      const startDate = new Date(block.start)
      const endDate = new Date(block.end)
      const startMinYesterday = startDate.getHours() * 60 + startDate.getMinutes()
      const durationMin = Math.max(
        15,
        Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
      )
      const overflowMinutes = startMinYesterday + durationMin - 1440
      const remainderMin = Math.min(1440, Math.max(15, overflowMinutes))

      startInfo = { hours: 0, minutes: 0, totalMinutes: 0 }
      endInfo = {
        hours: Math.floor(remainderMin / 60),
        minutes: remainderMin % 60,
        totalMinutes: remainderMin,
      }
    } else {
      startInfo = getMinutesFromMidnight(block.start)
      endInfo = getMinutesFromMidnight(block.end)

      // Check if end is next day or before start
      const startDate = new Date(block.start)
      const endDate = new Date(block.end)
      const durationMin = Math.round((endDate.getTime() - startDate.getTime()) / 60000)

      if (endDate.getDate() !== startDate.getDate() || startInfo.totalMinutes + durationMin > 1440) {
        endInfo = { hours: 24, minutes: 0, totalMinutes: 1440 }
      } else if (endInfo.totalMinutes <= startInfo.totalMinutes) {
        endInfo = {
          hours: Math.floor((startInfo.totalMinutes + 15) / 60),
          minutes: (startInfo.totalMinutes + 15) % 60,
          totalMinutes: startInfo.totalMinutes + 15,
        }
      }
    }

    return {
      block,
      startInfo,
      endInfo,
      startMin: startInfo.totalMinutes,
      endMin: endInfo.totalMinutes,
      isCrossOver: isCrossOverFromYesterday,
    }
  })

  // Sort by start time, then duration descending
  items.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin
    return b.endMin - a.endMin
  })

  // 2. Cluster overlapping blocks
  const clusters: (typeof items)[] = []
  let currentCluster: typeof items = []
  let clusterEnd = -1

  for (const item of items) {
    if (currentCluster.length === 0) {
      currentCluster.push(item)
      clusterEnd = item.endMin
    } else {
      if (item.startMin < clusterEnd) {
        currentCluster.push(item)
        clusterEnd = Math.max(clusterEnd, item.endMin)
      } else {
        clusters.push(currentCluster)
        currentCluster = [item]
        clusterEnd = item.endMin
      }
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster)
  }

  // 3. For each cluster, assign columns
  const positioned: PositionedTimeBlock[] = []

  for (const cluster of clusters) {
    const columns: (typeof items)[] = []

    for (const item of cluster) {
      let placed = false
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const lastInCol = columns[colIdx][columns[colIdx].length - 1]
        if (lastInCol.endMin <= item.startMin) {
          columns[colIdx].push(item)
          placed = true
          break
        }
      }

      if (!placed) {
        columns.push([item])
      }
    }

    const totalColumns = columns.length

    for (let colIdx = 0; colIdx < totalColumns; colIdx++) {
      for (const item of columns[colIdx]) {
        // EXACT FORMULA: (hours + minutes / 60) * HOUR_HEIGHT_IN_PIXELS
        const topPx = (item.startInfo.hours + item.startInfo.minutes / 60) * HOUR_HEIGHT_IN_PIXELS
        const durationHours = (item.endMin - item.startMin) / 60
        const heightPx = Math.max(22, durationHours * HOUR_HEIGHT_IN_PIXELS)
        const widthPct = 100 / totalColumns
        const leftPct = colIdx * widthPct

        positioned.push({
          block: item.block,
          topPx,
          heightPx,
          leftPct,
          widthPct,
          isCrossOver: item.isCrossOver,
        })
      }
    }
  }

  return positioned
}
