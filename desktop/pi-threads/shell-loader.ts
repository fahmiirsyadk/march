import type {
  ComposerState,
  ComposerStateRequest,
  ProjectCommitEntry,
} from '../../shared/desktop-contracts.ts'
import {
  getComposerSkills,
  getComposerSlashCommands,
  getComposerState,
  subscribeDesktopEvents as subscribeRuntimeEvents,
} from '../pi-desktop-runtime.ts'
import {
  captureProjectDiffBaseline,
  listProjectCommits,
  loadProjectDiff,
  loadProjectDiffStats,
  loadProjectGitState,
} from '../project-git.ts'
import { shutdownRuntimeHosts } from '../runtime-host/client-bridge.ts'
import { disposeSessionWatcher, setWatchedSessionPath } from './session-watch.ts'

export { refreshShellIndex } from './shell-index.ts'
export { loadShellState } from './shell-state.ts'
export { loadInboxThreadList } from './thread-loader.ts'

export async function loadComposerState(
  request: ComposerStateRequest = {},
): Promise<ComposerState> {
  return getComposerState(request)
}

export async function loadComposerSlashCommands(request: ComposerStateRequest = {}) {
  return getComposerSlashCommands(request)
}

export async function loadComposerSkills(request: ComposerStateRequest = {}) {
  return getComposerSkills(request)
}

export async function loadProjectCommitHistory(
  projectId: string,
  limit?: number | undefined | null,
): Promise<ProjectCommitEntry[]> {
  return listProjectCommits(projectId, limit ?? null)
}

export {
  captureProjectDiffBaseline,
  listProjectCommits,
  loadProjectDiff,
  loadProjectDiffStats,
  loadProjectGitState,
  setWatchedSessionPath,
}

export const subscribeDesktopEvents = subscribeRuntimeEvents

export async function disposeDesktopRuntime() {
  disposeSessionWatcher()
  shutdownRuntimeHosts()
}
