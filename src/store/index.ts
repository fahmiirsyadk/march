import { create } from 'zustand'
import type {
  ArchivedThread,
  ChatSidebarState,
  ComposerState,
  ProjectGitState,
  ShellState,
  ThreadData,
} from '../app/desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../app/state/workspace'
import type { Project, Thread, View } from '../app/types'

type DataSlice = {
  shellState: ShellState | null
  shellLoading: boolean
  composerState: ComposerState | null
  liveThreadData: ThreadData | null
  threadData: ThreadData | null
  projectGitState: ProjectGitState | null
  projectGitLoading: boolean
  archivedThreads: ArchivedThread[]
  chatSidebarState: ChatSidebarState | null
  chatSidebarLoading: boolean
  threadRefreshKey: number
  threadHistoryCompactions: number
  selectedChatGroupId: string | null
  activeThreadLoading: boolean

  fetchShellState: () => Promise<ShellState | null>
  refreshShellState: () => Promise<ShellState | null>
  loadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<Thread[]>
  fetchComposerState: (request?: unknown) => Promise<ComposerState | null>
  setLiveThreadData: (data: ThreadData | null) => void
  setThreadData: (data: ThreadData | null) => void
  fetchProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  loadArchivedThreads: () => Promise<ArchivedThread[]>
  refreshChatSidebarState: (groupId?: string | null) => Promise<ChatSidebarState | null>
  createChatGroup: (name: string) => Promise<ChatSidebarState | null>
  setThreadRefreshKey: (key: number) => void
  setThreadHistoryCompactions: (compactions: number) => void
  setSelectedChatGroupId: (id: string | null) => void
  setActiveThreadLoading: (loading: boolean) => void
}

export type AppStore = WorkspaceState & {
  dispatch: (action: WorkspaceAction) => void
  projects: Project[]
  setProjects: (projects: Project[]) => void
} & DataSlice

export const useAppStore = create<AppStore>()((set, get) => {
  const initialWorkspaceState: WorkspaceState = {
    activeView: 'code' as View,
    selectedProjectId: '',
    hasSelectedProject: false,
    selectedInboxSessionPath: null,
    selectedThreadId: null,
    selectedSessionPath: null,
    terminalVisible: false,
    terminalVisibleBySession: {},
    restoreTerminalVisibleOnGitOpsClose: false,
    takeoverVisible: false,
    takeoverOverrides: {},
    gitOpsReturnView: 'code',
    selectedDiffFilePath: null,
    utilityViewReturnState: null,
    settingsOpen: false,
    settingsPanelOpen: false,
    collapsedProjectIds: {},
  }

  return {
    ...initialWorkspaceState,
    projects: [],
    setProjects: (projects: Project[]) => set({ projects }),

    dispatch: (action: WorkspaceAction) => {
      void import('../app/state/workspace').then(({ workspaceReducer }) => {
        const currentState = get()
        const workspaceState: WorkspaceState = {
          activeView: currentState.activeView,
          selectedProjectId: currentState.selectedProjectId,
          hasSelectedProject: currentState.hasSelectedProject,
          selectedInboxSessionPath: currentState.selectedInboxSessionPath,
          selectedThreadId: currentState.selectedThreadId,
          selectedSessionPath: currentState.selectedSessionPath,
          terminalVisible: currentState.terminalVisible,
          terminalVisibleBySession: currentState.terminalVisibleBySession,
          restoreTerminalVisibleOnGitOpsClose: currentState.restoreTerminalVisibleOnGitOpsClose,
          takeoverVisible: currentState.takeoverVisible,
          takeoverOverrides: currentState.takeoverOverrides,
          gitOpsReturnView: currentState.gitOpsReturnView,
          selectedDiffFilePath: currentState.selectedDiffFilePath,
          utilityViewReturnState: currentState.utilityViewReturnState,
          settingsOpen: currentState.settingsOpen,
          settingsPanelOpen: currentState.settingsPanelOpen,
          collapsedProjectIds: currentState.collapsedProjectIds,
        }
        const nextState = workspaceReducer(workspaceState, action)
        set({ ...nextState })
      })
    },

    shellState: null,
    shellLoading: false,
    composerState: null,
    liveThreadData: null,
    threadData: null,
    projectGitState: null,
    projectGitLoading: false,
    archivedThreads: [],
    chatSidebarState: null,
    chatSidebarLoading: false,
    threadRefreshKey: 0,
    threadHistoryCompactions: 0,
    selectedChatGroupId: null,
    activeThreadLoading: false,

    fetchShellState: async () => {
      set({ shellLoading: true })
      try {
        const state = await (window.piDesktop?.getShellState?.() ?? null)
        set({
          shellState: state,
          shellLoading: false,
          projects: state?.projects ?? [],
        })
        return state
      } catch {
        set({ shellLoading: false })
        return null
      }
    },

    refreshShellState: async () => {
      try {
        const state = await (window.piDesktop?.getShellState?.() ?? null)
        set({ shellState: state, projects: state?.projects ?? [] })
        return state
      } catch {
        return null
      }
    },

    loadProjectThreads: async (projectId: string, options = {}) => {
      const threads = await (window.piDesktop?.getProjectThreads?.(projectId, options) ?? [])
      const current = get().shellState
      if (current) {
        set({
          shellState: {
            ...current,
            projects: current.projects.map((p) =>
              p.id === projectId
                ? {
                    ...p,
                    threads,
                    threadCount: threads.length,
                    threadsLoaded: true,
                  }
                : p,
            ),
          },
        })
      }
      return threads
    },

    fetchComposerState: async (request = {}) => {
      const state = await (window.piDesktop?.getComposerState?.(request as never) ?? null)
      set({ composerState: state })
      return state
    },

    setLiveThreadData: (data) => set({ liveThreadData: data }),
    setThreadData: (data) => set({ threadData: data }),

    fetchProjectGitState: async (projectId: string) => {
      set({ projectGitLoading: true })
      try {
        const state = await (window.piDesktop?.getProjectGitState?.(projectId) ?? null)
        set({ projectGitState: state, projectGitLoading: false })
        return state
      } catch {
        set({ projectGitLoading: false })
        return null
      }
    },

    loadArchivedThreads: async () => {
      const threads = await (window.piDesktop?.getArchivedThreads?.() ?? [])
      set({ archivedThreads: threads })
      return threads
    },

    refreshChatSidebarState: async (groupId) => {
      const currentGroupId = groupId ?? get().selectedChatGroupId
      const state = await (window.piDesktop?.getChatSidebarState?.(currentGroupId) ?? null)
      set({ chatSidebarState: state })
      return state
    },

    createChatGroup: async (name: string) => {
      const state = await (window.piDesktop?.createChatGroup?.(name) ?? null)
      set({ chatSidebarState: state })
      if (state?.selectedGroupId) set({ selectedChatGroupId: state.selectedGroupId })
      return state
    },

    setThreadRefreshKey: (key) => set({ threadRefreshKey: key }),
    setThreadHistoryCompactions: (compactions) => set({ threadHistoryCompactions: compactions }),
    setSelectedChatGroupId: (id) => set({ selectedChatGroupId: id }),
    setActiveThreadLoading: (loading) => set({ activeThreadLoading: loading }),
  }
})
