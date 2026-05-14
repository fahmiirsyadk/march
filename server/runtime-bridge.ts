import type { DesktopAction } from '../shared/desktop-actions.ts'
import type {
  AnyDesktopActionPayload,
  DesktopActionResult,
  DesktopEvent,
} from '../shared/desktop-contracts.ts'

export type RuntimeBridge = {
  handleAction(
    action: DesktopAction,
    payload: AnyDesktopActionPayload,
  ): Promise<DesktopActionResult>
  subscribeEvents(listener: (event: DesktopEvent) => void): () => void
  dispose(): void
}

export function createRuntimeBridge(): RuntimeBridge {
  const eventListeners = new Set<(event: DesktopEvent) => void>()

  let initialized = false

  async function ensureInitialized() {
    if (initialized) return
    initialized = true

    const { subscribeDesktopEvents } = await import('../desktop/runtime/desktop-events.ts')

    subscribeDesktopEvents((event: DesktopEvent) => {
      for (const listener of eventListeners) {
        listener(event)
      }
    })
  }

  return {
    async handleAction(action, payload) {
      await ensureInitialized()

      const { handleDesktopAction } = await import('../desktop/pi-threads/action-router.ts')

      try {
        const result = await handleDesktopAction(action, payload)
        return {
          ok: true,
          at: new Date().toISOString(),
          payload: { action, payload },
          result: result ?? null,
        }
      } catch (error) {
        return {
          ok: false,
          at: new Date().toISOString(),
          payload: { action, payload },
          result: {
            error: error instanceof Error ? error.message : 'Action failed',
          },
        }
      }
    },

    subscribeEvents(listener) {
      eventListeners.add(listener)
      void ensureInitialized()

      return () => {
        eventListeners.delete(listener)
      }
    },

    dispose() {
      eventListeners.clear()
    },
  }
}
