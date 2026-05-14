import type { ProjectDiffBaseline, ProjectDiffRenderMode } from '../desktop/types'
import { ChatWorkspaceView } from '../features/chat/chat-workspace-view'
import { CodeWorkspaceView } from '../features/code/code-workspace-view'
import type { AppShellController } from './useAppShellController'

type AppShellWorkspaceProps = {
  controller: AppShellController
  activeComposerState: AppShellController['activeComposerState']
  activeThreadData: AppShellController['activeThreadData']
  composerProjectId: string
  currentProjectName: string
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  terminalDrawerVisible: boolean
  terminalDrawerOverlay?: boolean
  terminalSessionPath: string | null
  workspaceContentClass: string
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void
  sidebarCollapsed: boolean
  sidebarAutoHidden: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
  onArtifactDrawerOverlayChange?:
    | ((visible: boolean, onClose?: (() => void) | undefined) => void)
    | undefined
}

export function AppShellWorkspace({
  controller,
  activeComposerState,
  activeThreadData,
  composerProjectId,
  currentProjectName,
  diffBaseline,
  diffRenderMode,
  terminalDrawerVisible,
  terminalDrawerOverlay = false,
  terminalSessionPath,
  workspaceContentClass,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  sidebarCollapsed,
  sidebarAutoHidden,
  sidebarCompactMode,
  onToggleSidebar,
  onArtifactDrawerOverlayChange,
}: AppShellWorkspaceProps) {
  const { state } = controller

  if (state.activeView !== 'chat') {
    return (
      <CodeWorkspaceView
        controller={controller}
        activeComposerState={activeComposerState}
        activeThreadData={activeThreadData}
        composerProjectId={composerProjectId}
        currentProjectName={currentProjectName}
        diffBaseline={diffBaseline}
        diffRenderMode={diffRenderMode}
        terminalDrawerVisible={terminalDrawerVisible}
        terminalDrawerOverlay={terminalDrawerOverlay}
        terminalSessionPath={terminalSessionPath}
        workspaceContentClass={workspaceContentClass}
        onSetDiffBaseline={onSetDiffBaseline}
        onSetDiffRenderMode={onSetDiffRenderMode}
        sidebarCollapsed={sidebarCollapsed}
        sidebarAutoHidden={sidebarAutoHidden}
        sidebarCompactMode={sidebarCompactMode}
        onToggleSidebar={onToggleSidebar}
      />
    )
  }

  return (
    <ChatWorkspaceView
      controller={controller}
      activeComposerState={activeComposerState}
      activeThreadData={activeThreadData}
      composerProjectId={composerProjectId}
      diffBaseline={diffBaseline}
      diffRenderMode={diffRenderMode}
      terminalSessionPath={terminalSessionPath}
      onSetDiffBaseline={onSetDiffBaseline}
      onSetDiffRenderMode={onSetDiffRenderMode}
      sidebarCollapsed={sidebarCollapsed}
      sidebarAutoHidden={sidebarAutoHidden}
      sidebarCompactMode={sidebarCompactMode}
      onToggleSidebar={onToggleSidebar}
      onArtifactDrawerOverlayChange={onArtifactDrawerOverlayChange}
    />
  )
}
