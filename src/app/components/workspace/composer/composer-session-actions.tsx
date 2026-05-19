import { GitFork } from 'lucide-react'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { popoverPanelClass, toolbarButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { Tooltip } from '../../common/tooltip'

type SessionAction = 'fork' | 'clone'

type ComposerSessionActionsProps = {
  anchorRef: RefObject<HTMLButtonElement | null>
  isStreaming: boolean
  isCompacting: boolean
  disabled: boolean
  onSelect: (action: SessionAction) => void
}

const sessionActions: {
  action: SessionAction
  label: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    action: 'fork',
    label: 'Fork session',
    description: 'Create a new session from this point.',
    icon: <GitFork className="h-3.5 w-3.5" />,
  },
  {
    action: 'clone',
    label: 'Clone session',
    description: 'Duplicate the current branch into a new session file.',
    icon: <GitFork className="h-3.5 w-3.5 rotate-180" />,
  },
]

export function ComposerSessionActions({
  anchorRef,
  isStreaming,
  isCompacting,
  disabled,
  onSelect,
}: ComposerSessionActionsProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ bottom: 0, left: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const anchor = anchorRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    setPosition({
      bottom: window.innerHeight - rect.top + 6,
      left: Math.max(8, rect.left),
    })
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, anchorRef])

  const handleSelect = useCallback(
    (action: SessionAction) => {
      setOpen(false)
      onSelect(action)
    },
    [onSelect],
  )

  const isDisabled = disabled || isStreaming || isCompacting

  return (
    <>
      <Tooltip content="Session actions">
        <button
          ref={anchorRef}
          type="button"
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
            isDisabled && 'cursor-not-allowed opacity-40',
          )}
          onClick={() => !isDisabled && setOpen((current) => !current)}
          aria-label="Session actions"
          aria-expanded={open}
          disabled={isDisabled}
        >
          <GitFork className="h-3.5 w-3.5" />
        </button>
      </Tooltip>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className={cn(
              'fixed z-[140] w-72 rounded-xl border p-1.5 shadow-lg',
              popoverPanelClass,
            )}
            style={{ bottom: position.bottom, left: position.left }}
            role="menu"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {sessionActions.map((item) => (
              <button
                key={item.action}
                type="button"
                role="menuitem"
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                  toolbarButtonClass,
                  'hover:bg-[color:var(--surface-hover)]',
                )}
                onClick={() => handleSelect(item.action)}
              >
                <span className="mt-0.5 shrink-0 text-[color:var(--muted)]">{item.icon}</span>
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-[color:var(--text)]">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-[color:var(--muted)]">{item.description}</div>
                </div>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
