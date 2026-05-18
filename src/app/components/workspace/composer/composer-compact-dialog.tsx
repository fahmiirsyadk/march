import { ArrowUp, Sparkles, X } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { popoverPanelClass, primaryButtonClass, toolbarButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'

type CompactDialogProps = {
  anchorRef: RefObject<HTMLButtonElement | null>
  isCompacting: boolean
  compactDisabled: boolean
  onClose: () => void
  onCompact: (instructions: string) => void
}

const compactPresets = [
  { label: 'Keep code changes', instructions: 'Focus on recent code changes and decisions.' },
  { label: 'Keep decisions', instructions: 'Preserve key decisions and action items.' },
  { label: 'Summarize briefly', instructions: 'Create a very brief summary of the conversation.' },
]

export function CompactDialog({
  anchorRef,
  isCompacting,
  compactDisabled,
  onClose,
  onCompact,
}: CompactDialogProps) {
  const [instructions, setInstructions] = useState('')
  const [position, setPosition] = useState({ bottom: 0, left: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    setPosition({
      bottom: window.innerHeight - rect.top + 8,
      left: rect.left,
    })

    inputRef.current?.focus()
  }, [anchorRef])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = () => {
    if (isCompacting || compactDisabled) return
    onCompact(instructions.trim())
  }

  const handlePreset = (presetInstructions: string) => {
    setInstructions(presetInstructions)
    inputRef.current?.focus()
  }

  return createPortal(
    <div
      ref={panelRef}
      className={cn('fixed z-[140] w-80 rounded-xl border p-3 shadow-lg', popoverPanelClass)}
      style={{
        bottom: position.bottom,
        left: Math.max(8, position.left),
      }}
      role="dialog"
      aria-label="Compact context"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent)]" />
          <span className="text-[13px] font-medium text-[color:var(--text)]">Compact context</span>
        </div>
        <button
          type="button"
          className={cn('h-6 w-6 rounded-md', toolbarButtonClass)}
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-2 text-[11px] text-[color:var(--muted)]">
        Add optional instructions to guide what the summary should preserve.
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {compactPresets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
              instructions === preset.instructions
                ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-bg-subtle)] text-[color:var(--accent)]'
                : 'border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent-border)] hover:bg-[color:var(--accent-bg-subtle)] hover:text-[color:var(--text)]',
            )}
            onClick={() => handlePreset(preset.instructions)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          className="min-w-0 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--panel-2)] px-2.5 py-1.5 text-[12px] text-[color:var(--text)] placeholder:text-[color:var(--muted-2)] outline-none focus:border-[color:var(--accent-border)]"
          placeholder="e.g. Focus on the API changes..."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSubmit()
            }
          }}
          disabled={isCompacting}
        />
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] transition-colors',
            isCompacting || compactDisabled
              ? 'cursor-not-allowed opacity-40'
              : 'hover:bg-[color:var(--surface-hover)]',
            instructions.length > 0
              ? 'border border-[color:var(--accent-border)] bg-[color:var(--accent-bg)] text-[color:var(--text)]'
              : 'border border-[color:var(--border)] text-[color:var(--muted)]',
          )}
          disabled={isCompacting || compactDisabled}
          onClick={handleSubmit}
        >
          {isCompacting ? (
            <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--text)] border-t-transparent" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <button
        type="button"
        className={cn(
          primaryButtonClass,
          'mt-2.5 w-full justify-center text-[12px]',
          !(instructions || compactDisabled) &&
            'border-[color:var(--border)] bg-transparent text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
        )}
        disabled={compactDisabled}
        onClick={() => onCompact('')}
      >
        Compact now
      </button>
    </div>,
    document.body,
  )
}
