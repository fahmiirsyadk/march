import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDesktopActionErrorMessage } from '../../../../desktop/action-results'
import type { DesktopAction } from '../../../../desktop/actions'
import { getErrorMessage } from '../../../../desktop/error-messages'
import type {
  ComposerFilePickerState,
  ComposerModel,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DesktopActionInvoker,
} from '../../../../desktop/types'
import { useDismissibleLayer } from '../../../../hooks/useDismissibleLayer'
import type { View } from '../../../../types'
import { useComposerAttachmentPicker } from '../useComposerAttachmentPicker'
import { useComposerClipboardHandlers } from '../useComposerClipboardHandlers'
import { useComposerSubmission } from '../useComposerSubmission'
import { useComposerDraftState } from './useComposerDraftState'

const thinkingLevelLabels: Record<ComposerThinkingLevel, string> = {
  off: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
}

function getModelLabel(model: ComposerModel | null) {
  if (!model) {
    return 'No model'
  }

  return model.name
}

type UseComposerControllerProps = {
  activeView: View
  composerPanelRef: RefObject<HTMLDivElement | null>
  mainViewRef: RefObject<HTMLElement | null>
  workspaceFooterRef: RefObject<HTMLElement | null>
  model: ComposerModel | null
  projectId: string
  chatGroupId?: string | null | undefined
  sessionPath: string | null
  isStreaming: boolean
  replyActivityKey: string
  isCompacting: boolean
  isExtensionCommandRunning: boolean
  restoredQueuedPrompt: string | null
  streamingBehaviorPreference: ComposerStreamingBehavior
  onAction: DesktopActionInvoker
  onRestoredQueuedPromptApplied: () => void
  onListAttachmentEntries: (request: {
    projectId?: string | null
    path?: string | null
    rootPath?: string | null
  }) => Promise<ComposerFilePickerState | null>
}

export function useComposerController({
  activeView,
  composerPanelRef,
  mainViewRef,
  workspaceFooterRef,
  model,
  projectId,
  chatGroupId = null,
  sessionPath,
  isStreaming,
  replyActivityKey,
  isCompacting,
  isExtensionCommandRunning,
  restoredQueuedPrompt,
  streamingBehaviorPreference,
  onAction,
  onRestoredQueuedPromptApplied,
  onListAttachmentEntries,
}: UseComposerControllerProps) {
  const [openMenu, setOpenMenu] = useState<'model' | 'picker' | null>(null)
  const [localExtensionCommandRunning, setLocalExtensionCommandRunning] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [pendingSubmittedDraft, setPendingSubmittedDraft] = useState<string | null>(null)
  const pendingSubmittedReplyActivityKeyRef = useRef<string | null>(null)
  const pendingSubmittedDraftScopeKeyRef = useRef<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const composerMode = activeView === 'chat' ? 'chat' : 'code'
  const pickerButtonRef = useRef<HTMLButtonElement>(null)
  const pickerPanelRef = useRef<HTMLDivElement>(null)
  const modelButtonRef = useRef<HTMLButtonElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)
  const sendLockRef = useRef(false)
  const {
    activeComposerScopeKeyRef,
    activeDraftThreadIdRef,
    attachments,
    attachmentsRef,
    composerScopeKey,
    draft,
    draftThreadId,
    draftValueRef,
    setAttachmentValue,
    setDraftValue,
    skipNextDraftPersistenceRef,
  } = useComposerDraftState({
    composerMode,
    projectId,
    sessionPath,
    openMenu,
    setOpenMenu,
    setErrorMessage,
    restoredQueuedPrompt,
    onRestoredQueuedPromptApplied,
  })

  useDismissibleLayer({
    open: openMenu === 'model',
    onDismiss: () => setOpenMenu(null),
    refs: [modelButtonRef, modelMenuRef],
  })

  useEffect(() => {
    if (openMenu !== 'picker') {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null

      if (!target) {
        return
      }

      if (pickerButtonRef.current?.contains(target) || pickerPanelRef.current?.contains(target)) {
        return
      }

      if (composerPanelRef.current?.contains(target)) {
        return
      }

      if (mainViewRef.current?.contains(target) || workspaceFooterRef.current?.contains(target)) {
        setOpenMenu((current) => (current === 'picker' ? null : current))
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [composerPanelRef, mainViewRef, openMenu, workspaceFooterRef])

  const extensionCommandRunning = isExtensionCommandRunning || localExtensionCommandRunning
  const canSend =
    (draft.trim().length > 0 || attachments.length > 0) &&
    !isSending &&
    !pendingSubmittedDraft &&
    !isCompacting

  useEffect(() => {
    if (
      !pendingSubmittedDraft ||
      pendingSubmittedReplyActivityKeyRef.current === null ||
      pendingSubmittedReplyActivityKeyRef.current === replyActivityKey
    ) {
      return
    }

    if (draftValueRef.current === pendingSubmittedDraft) {
      setDraftValue('')
    }
    pendingSubmittedReplyActivityKeyRef.current = null
    setPendingSubmittedDraft(null)
  }, [draftValueRef, pendingSubmittedDraft, replyActivityKey, setDraftValue])

  useEffect(() => {
    if (!pendingSubmittedDraft || isSending || isStreaming) return
    const submittedReplyActivityKey = pendingSubmittedReplyActivityKeyRef.current
    const timeout = window.setTimeout(() => {
      if (pendingSubmittedReplyActivityKeyRef.current !== submittedReplyActivityKey) return
      pendingSubmittedReplyActivityKeyRef.current = null
      setPendingSubmittedDraft(null)
    }, 60_000)
    return () => window.clearTimeout(timeout)
  }, [isSending, isStreaming, pendingSubmittedDraft])

  useEffect(() => {
    if (pendingSubmittedDraftScopeKeyRef.current === composerScopeKey) return
    pendingSubmittedDraftScopeKeyRef.current = composerScopeKey
    if (pendingSubmittedDraft && isStreaming && replyActivityKey.length === 0) return
    pendingSubmittedReplyActivityKeyRef.current = null
    setPendingSubmittedDraft(null)
  }, [composerScopeKey, isStreaming, pendingSubmittedDraft, replyActivityKey])

  useEffect(() => {
    void composerScopeKey
    setLocalExtensionCommandRunning(false)
  }, [composerScopeKey])

  const {
    attachPickerAttachments,
    clearAttachments,
    openPickerDirectory,
    openPickerRoot,
    pickAttachments,
    pickerLoading,
    pickerState,
    removeAttachment,
    togglePendingPickerAttachment,
  } = useComposerAttachmentPicker({
    openMenu,
    pickerRootPath: projectId,
    pickerSessionKey: draftThreadId,
    setAttachments: setAttachmentValue,
    setErrorMessage,
    setOpenMenu,
    onListAttachmentEntries,
  })

  const runComposerAction = async (
    action: DesktopAction,
    payload: NonNullable<Parameters<DesktopActionInvoker>[1]>,
    options?: { closeMenu?: boolean } | undefined,
  ) => {
    try {
      const result = await onAction(action, payload)
      const actionErrorMessage = getDesktopActionErrorMessage(
        result,
        'Could not update the composer.',
      )
      if (actionErrorMessage) {
        setErrorMessage(actionErrorMessage)
        return false
      }
      setErrorMessage(null)
      if (options?.closeMenu ?? true) {
        setOpenMenu(null)
      }
      return true
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Could not update the composer.'))
      return false
    }
  }

  const { compact, send, sendExtensionCommand, stop } = useComposerSubmission({
    composerScopeKey,
    draftThreadId,
    isSending,
    isStreaming,
    isCompacting,
    onAction,
    projectId,
    chatGroupId,
    sessionPath,
    setAttachments: setAttachmentValue,
    setDraftValue,
    setErrorMessage,
    extensionCommandRunning,
    setExtensionCommandRunning: setLocalExtensionCommandRunning,
    setIsSending,
    setPendingSubmittedDraft,
    pendingSubmittedReplyActivityKeyRef,
    replyActivityKey,
    setOpenMenu,
    streamingBehaviorPreference,
    activeComposerScopeKeyRef,
    activeDraftThreadIdRef,
    attachmentsRef,
    draftValueRef,
    sendLockRef,
    skipNextDraftPersistenceRef,
  })

  const modelLabel = useMemo(() => getModelLabel(model), [model])

  const { handleDrop, handlePaste } = useComposerClipboardHandlers({
    setAttachments: setAttachmentValue,
    setDraftValue,
    setErrorMessage,
  })

  const handleSessionAction = useCallback(
    (action: 'fork' | 'clone') => {
      if (!sessionPath) return
      const desktopAction = action === 'fork' ? 'session.fork' : 'session.clone'
      void onAction(desktopAction, { sessionPath }).catch(() => undefined)
    },
    [onAction, sessionPath],
  )

  return {
    attachments,
    handleDrop,
    handlePaste,
    canSend,
    clearAttachments,
    clearError: () => setErrorMessage(null),
    draft: pendingSubmittedDraft ?? draft,
    errorMessage,
    extensionCommandRunning,
    isSending,
    inputLocked: isSending || pendingSubmittedDraft !== null || (isStreaming && !replyActivityKey),
    pickerButtonRef,
    pickerLoading,
    pickerOpen: openMenu === 'picker',
    pickerPanelRef,
    pickerState,
    modelButtonRef,
    modelLabel,
    modelMenuOpen: openMenu === 'model',
    modelMenuRef,
    isStreaming,
    pickAttachments,
    openPickerDirectory,
    openPickerRoot,
    removeAttachment,
    runComposerAction,
    compact,
    handleSessionAction,
    send,
    sendExtensionCommand,
    setDraft: setDraftValue,
    setOpenMenu,
    stop,
    attachPickerAttachments,
    togglePendingPickerAttachment,
    thinkingLevelLabels,
  }
}
