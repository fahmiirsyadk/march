import type { DesktopAction } from '../../shared/desktop-actions'
import type {
  AnyDesktopActionPayload,
  ComposerAttachment,
  DesktopEvent,
} from '../../shared/desktop-contracts'
import type { TerminalEvent, TerminalOpenRequest } from '../../shared/terminal-contracts'
import { createWsConnection } from './ws-client'

async function apiPost(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? `API request failed: ${path}`)
  }

  return response.json()
}

export function createPiDesktopApi() {
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
  const wsConnection = createWsConnection(wsUrl)

  const desktopListeners = new Set<(e: DesktopEvent) => void>()
  const terminalListeners = new Set<(e: TerminalEvent) => void>()

  function handleChannelEvent(data: { channel?: string; event?: unknown }) {
    if (data.channel === 'desktopEvent' && data.event) {
      for (const listener of desktopListeners) {
        listener(data.event as DesktopEvent)
      }
    } else if (data.channel === 'terminalEvent' && data.event) {
      for (const listener of terminalListeners) {
        listener(data.event as TerminalEvent)
      }
    }
  }

  function handleTypeEvent(data: { type?: string }) {
    if (!data.type || data.type === 'connected') return
    const terminalTypes = [
      'started',
      'restarted',
      'output',
      'updated',
      'exited',
      'error',
      'cleared',
    ]
    if (terminalTypes.includes(data.type)) {
      for (const listener of terminalListeners) {
        listener(data as unknown as TerminalEvent)
      }
    } else {
      for (const listener of desktopListeners) {
        listener(data as unknown as DesktopEvent)
      }
    }
  }

  wsConnection.onMessage((msg) => {
    const data = msg as { channel?: string; event?: unknown; type?: string }
    handleChannelEvent(data)
    handleTypeEvent(data)
  })

  return {
    platform: 'browser',

    clearClipboardImages: () => apiPost('clearClipboardImages', {}),
    getShellState: () => apiPost('getShellState', {}),
    getProjectGitState: (projectId: string) => apiPost('getProjectGitState', { projectId }),
    getProjectUsageSummary: (projectId: string) => apiPost('getProjectUsageSummary', { projectId }),
    getProjectDiff: (projectId: string, baseline = null) =>
      apiPost('getProjectDiff', { projectId, baseline }),
    getProjectDiffStats: (projectId: string, baseline = null) =>
      apiPost('getProjectDiffStats', { projectId, baseline }),
    captureProjectDiffBaseline: (projectId: string) =>
      apiPost('captureProjectDiffBaseline', { projectId }),
    listProjectCommits: (projectId: string, limit: number | null = null) =>
      apiPost('listProjectCommits', { projectId, limit }),
    searchPiPackages: (request = {}) => apiPost('searchPiPackages', request),
    getConfiguredPiPackages: (request = {}) => apiPost('getConfiguredPiPackages', request),
    installPiPackage: (request: unknown) => apiPost('installPiPackage', request),
    removePiPackage: (request: unknown) => apiPost('removePiPackage', request),
    searchPiSkills: (request = {}) => apiPost('searchPiSkills', request),
    getConfiguredPiSkills: (request = {}) => apiPost('getConfiguredPiSkills', request),
    installPiSkill: (request: unknown) => apiPost('installPiSkill', request),
    removePiSkill: (request: unknown) => apiPost('removePiSkill', request),
    startSkillCreatorSession: (request: unknown) => apiPost('startSkillCreatorSession', request),
    continueSkillCreatorSession: (request: unknown) =>
      apiPost('continueSkillCreatorSession', request),
    closeSkillCreatorSession: (sessionId: string) =>
      apiPost('closeSkillCreatorSession', { sessionId }),
    pickComposerAttachments: () => Promise.resolve([] satisfies ComposerAttachment[]),
    listProjectDirectoryEntries: (request = {}) => apiPost('listProjectDirectoryEntries', request),
    readClipboardSnapshot: (formats: string[] | null = null) =>
      apiPost('readClipboardSnapshot', { formats }),
    readClipboardFilePaths: () => apiPost('readClipboardFilePaths', {}),
    readClipboardImage: () => apiPost('readClipboardImage', {}),
    getAttachmentKindsForPaths: (paths: string[]) =>
      apiPost('getAttachmentKindsForPaths', { paths }),
    getPathForFile: () => null,
    listComposerAttachmentEntries: (request = {}) =>
      apiPost('listComposerAttachmentEntries', request),
    searchComposerAttachmentEntries: (request = {}) =>
      apiPost('searchComposerAttachmentEntries', request),
    getComposerState: (request = {}) => apiPost('getComposerState', request),
    getComposerSlashCommands: (request = {}) => apiPost('getComposerSlashCommands', request),
    getComposerSkills: (request = {}) => apiPost('getComposerSkills', request),
    getProjectThreads: (projectId: string, request: { chat?: boolean | undefined } = {}) =>
      apiPost('getProjectThreads', { projectId, chat: request.chat }),
    getChatSidebarState: (selectedGroupId: string | null = null) =>
      apiPost('getChatSidebarState', { selectedGroupId }),
    createChatGroup: (name: string) => apiPost('createChatGroup', { name }),
    listArtifacts: (conversationId: string | null = null) =>
      apiPost('listArtifacts', { conversationId }),
    getArtifact: (artifactSlug: string, conversationId: string | null = null) =>
      apiPost('getArtifact', { artifactSlug, conversationId }),
    updateArtifact: (artifactSlug: string, content: string, conversationId: string | null = null) =>
      apiPost('updateArtifact', { artifactSlug, content, conversationId }),
    editArtifact: (
      artifactSlug: string,
      edits: Array<{ oldText: string; newText: string }>,
      conversationId: string | null = null,
    ) => apiPost('editArtifact', { artifactSlug, edits, conversationId }),
    listArtifactVersions: (artifactSlug: string) =>
      apiPost('listArtifactVersions', { artifactSlug }),
    compileReactArtifact: (source: string) => apiPost('compileReactArtifact', { source }),
    getInboxThreads: () => apiPost('getInboxThreads', {}),
    getArchivedThreads: () => apiPost('getArchivedThreads', {}),
    getThread: (sessionPath: string, historyCompactions = 0) =>
      apiPost('getThread', { sessionPath, historyCompactions }),
    watchSession: async (sessionPath: string | null) => {
      await apiPost('watchSession', { sessionPath })
    },
    invokeAction: (action: DesktopAction, payload: AnyDesktopActionPayload = {}) =>
      apiPost('action', { action, payload }),
    listTerminals: () => apiPost('listTerminals', {}),
    openTerminal: (request: TerminalOpenRequest) => apiPost('terminalOpen', request),
    writeTerminal: async (sessionId: string, data: string) => {
      await apiPost('terminalWrite', { sessionId, data })
    },
    resizeTerminal: async (request: unknown) => {
      await apiPost('terminalResize', request)
    },
    closeTerminal: async (request: unknown) => {
      await apiPost('terminalClose', request)
    },
    statTerminalSessionFile: (sessionId: string) =>
      apiPost('terminalSessionFileStat', { sessionId }),
    getTerminalStatus: (sessionId: string) => apiPost('terminalStatus', { sessionId }),
    openExternal: (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer')
      return Promise.resolve(true)
    },
    openPath: (path: string) =>
      apiPost('openPath', { path }).then((result) => (result as { ok: boolean }).ok),
    saveTextToDownloads: (fileName: string, content: string) =>
      apiPost('saveTextToDownloads', { fileName, content }),
    subscribe: (listener: (event: DesktopEvent) => void) => {
      desktopListeners.add(listener)
      return () => {
        desktopListeners.delete(listener)
      }
    },
    subscribeTerminal: (listener: (event: TerminalEvent) => void) => {
      terminalListeners.add(listener)
      return () => {
        terminalListeners.delete(listener)
      }
    },
  }
}
