import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
import { getSessionPath } from '../../shared/pi-thread-action-payloads.ts'
import { forkSession, navigateSessionTree } from '../runtime-host/live-runtime-service.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'

type SessionActionHandler = (
  payload: AnyDesktopActionPayload,
) => Promise<ActionHandlerResult> | ActionHandlerResult

const sessionActionHandlers = {
  'session.fork': async (payload) => {
    const sessionPath = getSessionPath(payload)
    if (!sessionPath) return handledAction()

    try {
      const entryId = typeof payload.entryId === 'string' ? payload.entryId : undefined
      const result = await forkSession({ sessionPath, entryId })
      return handledAction({
        didMutate: true,
        newSessionPath: result.newSessionPath,
        forkedFromEntryId: result.forkedFromEntryId,
      })
    } catch (error) {
      return handledAction({
        error: error instanceof Error ? error.message : 'Failed to fork session.',
      })
    }
  },
  'session.navigate-tree': async (payload) => {
    const sessionPath = getSessionPath(payload)
    if (!sessionPath) return handledAction()

    const entryId = typeof payload.entryId === 'string' ? payload.entryId : null
    if (!entryId) return handledAction({ error: 'No entry ID provided for navigation.' })

    try {
      const result = await navigateSessionTree({ sessionPath, entryId })
      return handledAction({
        didMutate: result.ok && !result.cancelled,
        cancelled: result.cancelled,
      })
    } catch (error) {
      return handledAction({
        error: error instanceof Error ? error.message : 'Failed to navigate session tree.',
      })
    }
  },
} satisfies Partial<Record<DesktopAction, SessionActionHandler>>

export async function handleSessionDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  const handlers: Partial<Record<DesktopAction, SessionActionHandler>> = sessionActionHandlers
  const handler = handlers[action]
  return handler ? await handler(payload) : unhandledAction()
}
