import React, { useState, useEffect } from 'react'
import { X, Clock, Trash2, Check, Calendar as CalendarIcon } from 'lucide-react'
import { TimeBlock, TimeBlockCategory } from '@/data/ports/schemas'
import { useUpdateTimeBlock, useDeleteTimeBlock } from '../useTimeBlocks'

interface EditTimeBlockModalProps {
  isOpen: boolean
  onClose: () => void
  block: TimeBlock | null
}

const CATEGORIES: { id: TimeBlockCategory; label: string }[] = [
  { id: 'deep_work', label: 'Deep Work (Cyan)' },
  { id: 'learning', label: 'Learning (Violet)' },
  { id: 'recovery', label: 'Recovery (Mint)' },
  { id: 'personal', label: 'Personal (Mint)' },
  { id: 'admin', label: 'Admin (Amber)' },
  { id: 'meeting', label: 'Meeting (Slate/Violet)' },
  { id: 'external', label: 'External' },
]

export const EditTimeBlockModal: React.FC<EditTimeBlockModalProps> = ({
  isOpen,
  onClose,
  block,
}) => {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<TimeBlockCategory>('deep_work')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')

  const updateMutation = useUpdateTimeBlock()
  const deleteMutation = useDeleteTimeBlock()

  useEffect(() => {
    if (block) {
      setTitle(block.title)
      setCategory(block.category)

      const startD = new Date(block.start)
      const endD = new Date(block.end)

      const formatHHMM = (d: Date) =>
        `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`

      setStartTime(formatHHMM(startD))
      setEndTime(formatHHMM(endD))
    }
  }, [block, isOpen])

  if (!isOpen || !block) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    const baseDate = block.start.slice(0, 10)
    const newStart = new Date(`${baseDate}T${startTime}:00`)
    let newEnd = new Date(`${baseDate}T${endTime}:00`)

    // If end time is earlier or equal to start time (e.g. 23:45 -> 00:15), roll over to next day
    if (newEnd <= newStart) {
      newEnd = new Date(newEnd.getTime() + 24 * 60 * 60 * 1000)
    }

    updateMutation.mutate({
      id: block.id,
      patch: {
        title: title.trim(),
        category,
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
      },
    })

    onClose()
  }

  const handleDelete = () => {
    deleteMutation.mutate(block.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md card bg-surface border border-[rgba(255,255,255,0.12)] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        data-hub="action"
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[rgba(255,255,255,0.06)] shrink-0">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-action" />
            <h2 className="text-sm font-semibold text-text">Edit Time Block</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
            {block.gcal?.eventId && (
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-action/10 border border-action/25 text-action text-xs font-mono">
                <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Synced with Google Calendar ({block.source === 'gcal' ? 'Imported' : 'Exported'})
                </span>
              </div>
            )}

            <div>
              <label className="block font-medium text-text-muted mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-sm text-text focus:outline-none focus:border-action/60"
              />
            </div>

            <div>
              <label className="block font-medium text-text-muted mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TimeBlockCategory)}
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-text focus:outline-none focus:border-action/60"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <label className="block font-sans font-medium text-text-muted mb-1">Start Time</label>
                <input
                  type="time"
                  step="900"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-text focus:outline-none focus:border-action/60"
                />
              </div>

              <div>
                <label className="block font-sans font-medium text-text-muted mb-1">End Time</label>
                <input
                  type="time"
                  step="900"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.08)] text-text focus:outline-none focus:border-action/60"
                />
              </div>
            </div>
          </div>

          <div className="shrink-0 p-4 sm:p-5 border-t border-[rgba(255,255,255,0.06)] bg-surface-2/40 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-chip text-danger hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Block</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-chip text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="flex items-center space-x-1 px-3.5 py-1.5 rounded-chip bg-action text-black font-semibold hover:brightness-110 active:scale-95 transition-all shadow-sm"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
