import type { DesktopEvent } from '../../shared/desktop-contracts.ts'
import type {
  RuntimeHostRequestMap,
  RuntimeHostRequestName,
  RuntimeHostResponseMap,
} from './protocol.ts'

const desktopListeners = new Set<(event: DesktopEvent) => void>()
let hostEventsInitialized: Promise<void> | null = null

async function ensureHostEvents() {
  if (hostEventsInitialized) return
  hostEventsInitialized = (async () => {
    const { setRuntimeHostEventSink } = await import('./host-events.ts')
    const { emitDesktopEvent } = await import('../runtime/desktop-events.ts')
    setRuntimeHostEventSink((event: DesktopEvent) => {
      emitDesktopEvent(event)
      for (const listener of desktopListeners) {
        listener(event)
      }
    })
  })()
  await hostEventsInitialized
}

type LiveService = typeof import('./live-runtime-service.ts')

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function shutdownRuntimeHosts() {
  // Runtime runs in-process
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: switch-based dispatch needs many cases
export async function invokeRuntimeHost<TName extends RuntimeHostRequestName>(
  name: TName,
  payload: RuntimeHostRequestMap[TName],
): Promise<RuntimeHostResponseMap[TName]> {
  await ensureHostEvents()
  try {
    switch (name) {
      case 'getPiSessionStorage': {
        const agentDir = process.env.HOME ? `${process.env.HOME}/.pi/agent` : ''
        return { agentDir, sessionDir: agentDir } as RuntimeHostResponseMap[TName]
      }

      case 'loadPiSettings': {
        const { defaultPiSettings } = await import('../../shared/default-pi-settings.ts')
        return defaultPiSettings as unknown as RuntimeHostResponseMap[TName]
      }

      case 'loadPiThemeState': {
        return {
          selectedTheme: 'howcode-dark',
          themes: [],
          colors: {
            text: '#f7f8ff',
            muted: '#a9b2d7',
            dim: '#6b7399',
            accent: '#60a5fa',
            toolPendingBg: '#1a1b2e',
            userMessageBg: '#13141f',
            selectedBg: '#2d3148',
            success: '#22c55e',
            error: '#ef4444',
            warning: '#f59e0b',
            customMessageBg: '#1a1b2e',
            mdCodeBlock: '#1e1f32',
            mdHeading: '#f7f8ff',
            mdLink: '#60a5fa',
            mdCode: '#e2e8f0',
            mdQuote: '#a9b2d7',
          },
          exportColors: { pageBg: '#0d0e15', cardBg: '#13141f', infoBg: '#1a1b2e' },
          isLight: false,
          diagnostics: [],
        } as RuntimeHostResponseMap[TName]
      }

      case 'updatePiSetting': {
        const p = payload as RuntimeHostRequestMap['updatePiSetting']
        const { updatePiSettingInHost } = await import('./settings-service.ts')
        return (await updatePiSettingInHost(
          p.key,
          p.value,
          p.projectPath,
        )) as RuntimeHostResponseMap[TName]
      }

      case 'loadThreadSnapshot': {
        const p = payload as RuntimeHostRequestMap['loadThreadSnapshot']
        const { loadThreadSnapshot: loadFromService } = await import('./thread-snapshot-service.ts')
        return (await loadFromService(p)) as RuntimeHostResponseMap[TName]
      }

      case 'startSkillCreatorSession': {
        const p = payload as RuntimeHostRequestMap['startSkillCreatorSession']
        const { startSkillCreatorSession: createSession } = await import(
          './skill-creator-service.ts'
        )
        return (await createSession(p)) as RuntimeHostResponseMap[TName]
      }

      case 'continueSkillCreatorSession': {
        const p = payload as RuntimeHostRequestMap['continueSkillCreatorSession']
        const { continueSkillCreatorSession: continueSession } = await import(
          './skill-creator-service.ts'
        )
        return (await continueSession(p)) as RuntimeHostResponseMap[TName]
      }

      case 'closeSkillCreatorSession': {
        const p = payload as RuntimeHostRequestMap['closeSkillCreatorSession']
        const { closeSkillCreatorSession: closeSession } = await import(
          './skill-creator-service.ts'
        )
        return (await closeSession(p)) as RuntimeHostResponseMap[TName]
      }

      // ── Operations using composer-state.ts directly ──────────────────────

      case 'getComposerState': {
        const p = payload as RuntimeHostRequestMap['getComposerState']
        const { buildComposerStateSnapshot } = await import('../runtime/composer-state.ts')
        return (await buildComposerStateSnapshot(p.request)) as RuntimeHostResponseMap[TName]
      }

      case 'getComposerSlashCommands': {
        const p = payload as RuntimeHostRequestMap['getComposerSlashCommands']
        const { getComposerSlashCommands } = await import('../runtime/slash-commands.ts')
        return (await getComposerSlashCommands(p.request)) as RuntimeHostResponseMap[TName]
      }

      case 'getComposerSkills':
        return [] as RuntimeHostResponseMap[TName]

      // ── Operations delegated to live-runtime-service ──────────────────────

      case 'startNewThread':
      case 'selectProjectRuntime':
      case 'openThreadRuntime':
      case 'stopComposerRun': {
        const p = payload as { request: Record<string, unknown> }
        const svc = (await import('./live-runtime-service.ts')) as LiveService
        const fn = svc[name as keyof LiveService] as (req: unknown) => unknown
        const requestField = 'request' in (payload as object) ? (p.request ?? payload) : payload
        return (await fn(requestField)) as RuntimeHostResponseMap[TName]
      }

      case 'sendComposerPrompt':
      case 'dequeueComposerPrompt':
      case 'answerNativeAskQuestions': {
        const svc = (await import('./live-runtime-service.ts')) as LiveService
        const fn = svc[name as keyof LiveService] as (req: unknown) => unknown
        try {
          return (await fn(payload)) as RuntimeHostResponseMap[TName]
        } catch {
          if (name === 'sendComposerPrompt') {
            try {
              const p = payload as Record<string, unknown>
              const retryPayload = {
                ...p,
                sessionPath: null,
                request: { ...((p.request as Record<string, unknown>) ?? {}), sessionPath: null },
              }
              return (await fn(retryPayload)) as RuntimeHostResponseMap[TName]
            } catch {
              // Retry failed, fall through to stub return
            }
          }
          return getDefaultStub(name) as RuntimeHostResponseMap[TName]
        }
      }

      case 'setComposerModel': {
        const p = payload as RuntimeHostRequestMap['setComposerModel']
        const svc = (await import('./live-runtime-service.ts')) as LiveService
        return (await svc.setComposerModel(
          p.request,
          p.provider,
          p.modelId,
        )) as RuntimeHostResponseMap[TName]
      }

      case 'setComposerThinkingLevel': {
        const p = payload as RuntimeHostRequestMap['setComposerThinkingLevel']
        const svc = (await import('./live-runtime-service.ts')) as LiveService
        return (await svc.setComposerThinkingLevel(
          p.request,
          p.level,
        )) as RuntimeHostResponseMap[TName]
      }

      default:
        return getDefaultStub(name) as RuntimeHostResponseMap[TName]
    }
  } catch {
    return getDefaultStub(name) as RuntimeHostResponseMap[TName]
  }
}

export async function invalidateRuntimeHostSettings() {
  // Settings are refreshed directly in-process
}

export function subscribeRuntimeHostEvents(listener: (event: DesktopEvent) => void) {
  desktopListeners.add(listener)
  return () => {
    desktopListeners.delete(listener)
  }
}

function getDefaultStub(name: string): unknown {
  switch (name) {
    case 'getComposerState':
    case 'startNewThread':
    case 'selectProjectRuntime':
    case 'openThreadRuntime':
    case 'dequeueComposerPrompt':
    case 'generateGitCommitMessage':
    case 'startSkillCreatorSession':
    case 'continueSkillCreatorSession':
      return null
    case 'getComposerSlashCommands':
    case 'getComposerSkills':
    case 'listConfiguredPiPackages':
    case 'listConfiguredPiSkills':
      return []
    case 'stopComposerRun':
    case 'setComposerModel':
    case 'setComposerThinkingLevel':
    case 'invalidateRuntimeSettings':
    case 'closeSkillCreatorSession':
      return { ok: true }
    case 'sendComposerPrompt':
      return { outcome: 'stopped', sessionPath: null, threadId: null }
    case 'installPiPackage':
    case 'removePiPackage':
    case 'installPiSkill':
    case 'removePiSkill':
      return { ok: false, error: 'Not available' }
    case 'answerNativeAskQuestions':
      return { ok: false }
    default:
      throw new Error(`Runtime host not available: ${name}`)
  }
}
