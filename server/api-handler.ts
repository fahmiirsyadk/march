import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import fuzzysort from 'fuzzysort'
import type { RuntimeBridge } from './runtime-bridge.js'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
      if (body.length > 1_000_000) {
        req.destroy(new Error('Request body too large'))
        reject(new Error('Request body too large'))
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(data))
}

function getHomeDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? '/'
}

async function listDirectory(dirPath: string) {
  const absolute = path.resolve(dirPath)
  const entries: Array<{ path: string; name: string; kind: 'directory' }> = []
  try {
    const dirEntries = await fs.promises.readdir(absolute, {
      withFileTypes: true,
    })
    for (const entry of dirEntries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        entries.push({
          path: path.join(absolute, entry.name),
          name: entry.name,
          kind: 'directory',
        })
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

// ── Channel handlers ──────────────────────────────────────────────────────────

async function channelGetShellState(_params: unknown, res: ServerResponse) {
  try {
    const { loadShellState } = await import('../desktop/pi-threads/shell-loader.ts')
    const { getDesktopWorkingDirectory } = await import('../shared/desktop-working-directory.ts')
    const cwd = getDesktopWorkingDirectory()
    const state = await loadShellState(cwd)
    sendJson(res, 200, state)
  } catch (_error) {
    const cwd = process.cwd()
    const darkTheme = {
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
      exportColors: {
        pageBg: '#0d0e15',
        cardBg: '#13141f',
        infoBg: '#1a1b2e',
      },
      isLight: false,
      diagnostics: [],
    }
    sendJson(res, 200, {
      platform: process.platform,
      mockMode: false,
      productName: 'howcode',
      cwd,
      resolvedCwd: cwd,
      agentDir: process.env.HOME ? `${process.env.HOME}/.pi/agent` : '',
      sessionDir: process.env.HOME ? `${process.env.HOME}/.pi/agent` : '',
      appSettings: {},
      piSettings: {},
      piTheme: darkTheme,
      composer: null,
      projects: [],
    })
  }
}

async function channelGetProjectThreads(params: unknown, res: ServerResponse) {
  const { listProjectThreads } = await import('../desktop/thread-state-db.ts')
  const p = params as { projectId?: string; chat?: boolean }
  const threads = await listProjectThreads(p.projectId ?? '', { chat: p.chat })
  sendJson(res, 200, threads)
}

async function channelGetInboxThreads(_params: unknown, res: ServerResponse) {
  const { listInboxThreads } = await import('../desktop/thread-state-db.ts')
  const threads = await listInboxThreads()
  sendJson(res, 200, threads)
}

async function channelGetArchivedThreads(_params: unknown, res: ServerResponse) {
  const { listArchivedThreads } = await import('../desktop/thread-state-db.ts')
  const threads = await listArchivedThreads()
  sendJson(res, 200, threads)
}

async function channelGetThread(params: unknown, res: ServerResponse) {
  const { loadThread } = await import('../desktop/pi-threads/thread-loader.ts')
  const p = params as { sessionPath: string; historyCompactions?: number }
  try {
    const thread = await loadThread(p.sessionPath, {
      historyCompactions: p.historyCompactions ?? 0,
    })
    sendJson(res, 200, thread)
  } catch {
    sendJson(res, 200, null)
  }
}

async function channelGetComposerState(params: unknown, res: ServerResponse) {
  const { getComposerState } = await import('../desktop/pi-desktop-runtime.ts')
  const p = params as Record<string, unknown>
  try {
    const state = await getComposerState(p)
    sendJson(res, 200, state)
  } catch {
    sendJson(res, 200, null)
  }
}

async function channelGetComposerSlashCommands(_params: unknown, res: ServerResponse) {
  const { fallbackAppSlashCommands } = await import('../shared/composer-slash-commands.ts')
  sendJson(res, 200, fallbackAppSlashCommands)
}

async function channelGetProjectGitState(params: unknown, res: ServerResponse) {
  const p = params as { projectId: string }
  try {
    const { loadProjectGitState } = await import('../desktop/project-git/project-state.ts')
    const state = await loadProjectGitState(p.projectId)
    sendJson(
      res,
      200,
      state ?? {
        projectId: p.projectId,
        isGitRepo: false,
        branch: null,
        fileCount: 0,
        stagedFileCount: 0,
        unstagedFileCount: 0,
        insertions: 0,
        deletions: 0,
        hasOrigin: false,
        originName: null,
        originUrl: null,
        gitOpsModeOverride: null,
      },
    )
  } catch {
    sendJson(res, 200, {
      projectId: p.projectId,
      isGitRepo: false,
      branch: null,
      fileCount: 0,
      stagedFileCount: 0,
      unstagedFileCount: 0,
      insertions: 0,
      deletions: 0,
      hasOrigin: false,
      originName: null,
      originUrl: null,
      gitOpsModeOverride: null,
    })
  }
}

async function channelGetProjectDiff(params: unknown, res: ServerResponse) {
  const p = params as { projectId: string; baseline?: Record<string, unknown> | null }
  try {
    const { loadProjectDiff } = await import('../desktop/project-git/commit-context.ts')
    const diff = await loadProjectDiff(p.projectId, p.baseline ?? null)
    sendJson(res, 200, diff)
  } catch {
    sendJson(res, 200, null)
  }
}

async function channelGetProjectDiffStats(params: unknown, res: ServerResponse) {
  const p = params as { projectId: string; baseline?: Record<string, unknown> | null }
  try {
    const { loadProjectDiffStats } = await import('../desktop/project-git/commit-context.ts')
    const stats = await loadProjectDiffStats(p.projectId, p.baseline ?? null)
    sendJson(res, 200, stats)
  } catch {
    sendJson(res, 200, null)
  }
}

async function channelCaptureProjectDiffBaseline(params: unknown, res: ServerResponse) {
  const p = params as { projectId: string }
  try {
    const { captureProjectDiffBaseline } = await import(
      '../desktop/project-git/project-diff-baselines.ts'
    )
    const baseline = await captureProjectDiffBaseline(p.projectId)
    sendJson(res, 200, baseline)
  } catch {
    sendJson(res, 200, null)
  }
}

async function channelListProjectCommits(params: unknown, res: ServerResponse) {
  const p = params as { projectId: string; limit?: number }
  try {
    const { listProjectCommits } = await import('../desktop/project-git/project-commits.ts')
    const commits = await listProjectCommits(p.projectId, p.limit ?? 50)
    sendJson(res, 200, commits)
  } catch {
    sendJson(res, 200, [])
  }
}

async function channelGetProjectUsageSummary(params: unknown, res: ServerResponse) {
  const p = params as { projectId: string }
  sendJson(res, 200, {
    projectId: p.projectId,
    sessionCount: 0,
    sessionsWithUsageCount: 0,
    assistantTurnCount: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    costTotal: 0,
    topSessions: [],
  })
}

async function channelListTerminals(_params: unknown, res: ServerResponse) {
  try {
    const { listTerminals } = await import('../desktop/terminal/manager.ts')
    const terminals = await listTerminals()
    sendJson(res, 200, terminals)
  } catch {
    sendJson(res, 200, [])
  }
}

async function channelTerminalOpen(params: unknown, res: ServerResponse) {
  try {
    const { openTerminal } = await import('../desktop/terminal/manager.ts')
    const result = await openTerminal(params as Record<string, unknown>)
    sendJson(res, 200, result)
  } catch {
    sendJson(res, 200, null)
  }
}

async function channelTerminalWrite(params: unknown, res: ServerResponse) {
  const p = params as { sessionId: string; data: string }
  try {
    const { writeTerminal } = await import('../desktop/terminal/manager.ts')
    await writeTerminal(p.sessionId, p.data)
    sendJson(res, 200, { ok: true })
  } catch {
    sendJson(res, 200, { ok: false })
  }
}

async function channelTerminalResize(params: unknown, res: ServerResponse) {
  const p = params as { sessionId: string; cols: number; rows: number }
  try {
    const { resizeTerminal } = await import('../desktop/terminal/manager.ts')
    await resizeTerminal(p.sessionId, p.cols, p.rows)
    sendJson(res, 200, { ok: true })
  } catch {
    sendJson(res, 200, { ok: false })
  }
}

async function channelTerminalClose(params: unknown, res: ServerResponse) {
  const p = params as { sessionId: string }
  try {
    const { closeTerminal } = await import('../desktop/terminal/manager.ts')
    await closeTerminal(p)
    sendJson(res, 200, { ok: true })
  } catch {
    sendJson(res, 200, { ok: false })
  }
}

async function channelTerminalStatus(params: unknown, res: ServerResponse) {
  const p = params as { sessionId: string }
  try {
    const { getTerminalStatus } = await import('../desktop/terminal/manager.ts')
    const status = await getTerminalStatus(p.sessionId)
    sendJson(res, 200, status)
  } catch {
    sendJson(res, 200, null)
  }
}

async function channelTerminalSessionFileStat(params: unknown, res: ServerResponse) {
  const p = params as { sessionId: string }
  try {
    const { statSessionFile } = await import('../desktop/terminal/manager.ts')
    const stat = await statSessionFile(p.sessionId)
    sendJson(res, 200, stat)
  } catch {
    sendJson(res, 200, null)
  }
}

async function channelInvokeAction(params: unknown, res: ServerResponse) {
  const p = params as { action: string; payload?: Record<string, unknown> }
  const { handleDesktopAction } = await import('../desktop/pi-threads/action-router.ts')
  try {
    const result = await handleDesktopAction(p.action as never, (p.payload ?? {}) as never)
    sendJson(res, 200, {
      ok: true,
      at: new Date().toISOString(),
      payload: { action: p.action, payload: p.payload ?? {} },
      result: result ?? null,
    })
  } catch {
    sendJson(res, 200, {
      ok: false,
      at: new Date().toISOString(),
      payload: { action: p.action, payload: p.payload ?? {} },
      result: { error: 'Action failed' },
    })
  }
}

async function channelListProjectDirectoryEntries(params: unknown, res: ServerResponse) {
  const p = params as { path?: string | null | undefined }
  const dir = p.path ? path.resolve(p.path) : getHomeDir()
  const entries = await listDirectory(dir)
  sendJson(res, 200, {
    homePath: getHomeDir(),
    currentPath: dir,
    parentPath: dir === '/' ? null : path.dirname(dir),
    entries,
  })
}

function resolveAttachmentDir(p: { path?: string | null; projectId?: string | null }): string {
  if (p.path) return path.resolve(p.path)
  if (p.projectId) return path.resolve(p.projectId)
  return process.cwd()
}

function direntKind(entry: fs.Dirent): 'directory' | 'file' | null {
  if (entry.isDirectory()) return 'directory'
  if (entry.isFile()) return 'file'
  return null
}

const ignoredSearchDirs = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'build',
  'dist',
  'out',
  '.next',
  '.turbo',
  '.vite',
])

type SearchEntry = {
  path: string
  name: string
  relativePath: string
  kind: 'directory' | 'file'
}

const searchIndexCache = new Map<string, { entries: SearchEntry[]; expiresAt: number }>()
const SEARCH_CACHE_TTL_MS = 30_000

async function readSearchDir(
  currentPath: string,
  entries: SearchEntry[],
  pendingDirs: string[],
  rootPath: string,
  maxEntries: number,
) {
  let dirEntries: fs.Dirent[]
  try {
    dirEntries = await fs.promises.readdir(currentPath, { withFileTypes: true })
  } catch {
    return 0
  }
  let count = 0
  for (const entry of dirEntries) {
    if (entry.name.startsWith('.')) continue
    count += 1
    if (count > maxEntries) break
    const entryPath = path.join(currentPath, entry.name)
    const relativePath = path.relative(rootPath, entryPath)
    if (entry.isDirectory()) {
      if (!ignoredSearchDirs.has(entry.name)) pendingDirs.push(entryPath)
      entries.push({ path: entryPath, name: entry.name, relativePath, kind: 'directory' })
    } else if (entry.isFile()) {
      entries.push({ path: entryPath, name: entry.name, relativePath, kind: 'file' })
    }
  }
  return count
}

async function buildSearchIndex(rootPath: string): Promise<SearchEntry[]> {
  const cached = searchIndexCache.get(rootPath)
  if (cached && cached.expiresAt > Date.now()) return cached.entries

  const entries: SearchEntry[] = []
  const pendingDirs = [rootPath]
  let visited = 0
  const maxEntries = 50_000

  while (pendingDirs.length > 0 && visited < maxEntries) {
    const currentPath = pendingDirs.shift()
    if (!currentPath) break
    visited += await readSearchDir(
      currentPath,
      entries,
      pendingDirs,
      rootPath,
      maxEntries - visited,
    )
  }

  searchIndexCache.set(rootPath, { entries, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS })
  return entries
}

function formatSearchResults(entries: SearchEntry[]) {
  return entries.map((e) => ({
    path: e.path,
    name: e.name,
    kind: e.kind,
    relativePath: e.relativePath,
  }))
}

async function channelSearchComposerAttachmentEntries(params: unknown, res: ServerResponse) {
  const p = params as { projectId?: string | null; query?: string | null; limit?: number | null }
  const rootPath = path.resolve(p.projectId ?? process.cwd())
  const query = (p.query?.trim() ?? '').toLowerCase()
  const limit = Math.max(1, Math.min(p.limit ?? 50, 100))

  const entries = await buildSearchIndex(rootPath)

  if (!query) {
    const sorted = entries
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
        return a.relativePath.localeCompare(b.relativePath)
      })
      .slice(0, limit)
    sendJson(res, 200, formatSearchResults(sorted))
    return
  }

  const hits = fuzzysort.go(query, entries, {
    key: 'relativePath',
    limit,
  })

  sendJson(res, 200, formatSearchResults(hits.map((h) => h.obj)))
}

async function channelListComposerAttachmentEntries(params: unknown, res: ServerResponse) {
  const p = params as {
    projectId?: string | null
    path?: string | null
    rootPath?: string | null
  }
  const dir = resolveAttachmentDir(p)
  const entries: Array<{
    path: string
    name: string
    kind: 'directory' | 'file'
  }> = []
  try {
    const dirEntries = await fs.promises.readdir(dir, { withFileTypes: true })
    for (const entry of dirEntries) {
      if (entry.name.startsWith('.')) continue
      const kind = direntKind(entry)
      if (kind)
        entries.push({
          path: path.join(dir, entry.name),
          name: entry.name,
          kind,
        })
    }
  } catch {
    /* ignore */
  }
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  sendJson(res, 200, { entries, currentPath: dir })
}

async function channelGetAttachmentKindsForPaths(params: unknown, res: ServerResponse) {
  const p = params as { paths: string[] }
  const result: Record<string, string | null> = {}
  for (const filePath of p.paths ?? []) {
    try {
      const st = await fs.promises.stat(filePath)
      result[filePath] = st.isFile() ? 'text' : null
    } catch {
      result[filePath] = null
    }
  }
  sendJson(res, 200, result)
}

async function channelStub(_params: unknown, res: ServerResponse) {
  sendJson(res, 200, null)
}

async function channelStubArray(_params: unknown, res: ServerResponse) {
  sendJson(res, 200, [])
}

async function channelOpenOk(_params: unknown, res: ServerResponse) {
  sendJson(res, 200, { ok: true })
}

async function channelListArtifacts(params: unknown, res: ServerResponse) {
  const { listArtifacts } = await import('../desktop/artifact-state-db.ts')
  const p = params as { conversationId?: string | null }
  sendJson(res, 200, listArtifacts(p.conversationId ?? null))
}

async function channelGetArtifact(params: unknown, res: ServerResponse) {
  const { getArtifact } = await import('../desktop/artifact-state-db.ts')
  const p = params as { artifactSlug: string; conversationId?: string | null }
  const artifact = await getArtifact(p.artifactSlug, p.conversationId ?? null)
  sendJson(res, 200, artifact)
}

async function channelUpdateArtifact(params: unknown, res: ServerResponse) {
  try {
    const { updateArtifact } = await import('../desktop/artifact-state-db.ts')
    const artifact = updateArtifact(params as Parameters<typeof updateArtifact>[0])
    sendJson(res, 200, artifact)
  } catch {
    sendJson(res, 200, null)
  }
}

async function channelEditArtifact(params: unknown, res: ServerResponse) {
  try {
    const { editArtifact } = await import('../desktop/artifact-state-db.ts')
    const artifact = editArtifact(params as Parameters<typeof editArtifact>[0])
    sendJson(res, 200, artifact)
  } catch {
    sendJson(res, 200, null)
  }
}

async function channelListArtifactVersions(params: unknown, res: ServerResponse) {
  const { listArtifactVersions } = await import('../desktop/artifact-state-db.ts')
  const p = params as { artifactSlug: string }
  sendJson(res, 200, listArtifactVersions(p.artifactSlug))
}

async function channelCompileReactArtifact(params: unknown, res: ServerResponse) {
  try {
    const { compileReactArtifact } = await import('../desktop/artifact-compiler.ts')
    const p = params as { source: string }
    const result = await compileReactArtifact(p.source)
    sendJson(res, 200, result)
  } catch {
    sendJson(res, 200, { ok: false, error: 'Compilation failed', warnings: [] })
  }
}

async function channelGetChatSidebarState(params: unknown, res: ServerResponse) {
  const { getChatSidebarState } = await import('../desktop/chat-state-db.ts')
  const p = params as { selectedGroupId?: string | null }
  const state = getChatSidebarState(p.selectedGroupId ?? null)
  sendJson(res, 200, state)
}

async function channelCreateChatGroup(params: unknown, res: ServerResponse) {
  try {
    const { createChatGroup } = await import('../desktop/chat-state-db.ts')
    const p = params as { name: string }
    const state = createChatGroup(p.name)
    sendJson(res, 200, state)
  } catch {
    sendJson(res, 200, null)
  }
}

async function channelSearchPiPackages(params: unknown, res: ServerResponse) {
  try {
    const { searchPiPackages } = await import('../desktop/pi-packages/catalog.ts')
    const p = params as { query?: string | null; cursor?: number | null; pageSize?: number | null }
    const result = await searchPiPackages(p.query ?? null, p.cursor ?? null, p.pageSize ?? null)
    sendJson(res, 200, result)
  } catch {
    sendJson(res, 200, {
      items: [],
      total: 0,
      query: '',
      sort: 'monthlyDownloads-desc',
      nextCursor: null,
    })
  }
}

async function channelGetConfiguredPiPackages(_params: unknown, res: ServerResponse) {
  try {
    const { listConfiguredPiPackages } = await import('../desktop/pi-packages/configured.ts')
    const result = await listConfiguredPiPackages()
    sendJson(res, 200, result)
  } catch {
    sendJson(res, 200, [])
  }
}

async function channelSearchPiSkills(params: unknown, res: ServerResponse) {
  try {
    const { searchPiSkills } = await import('../desktop/skills/catalog.ts')
    const p = params as { query?: string | null; limit?: number | null }
    const result = await searchPiSkills(p.query ?? null, p.limit ?? null)
    sendJson(res, 200, result)
  } catch {
    sendJson(res, 200, { items: [], total: 0, query: '' })
  }
}

async function channelGetConfiguredPiSkills(params: unknown, res: ServerResponse) {
  try {
    const { listConfiguredPiSkills } = await import('../desktop/skills/configured-skills.ts')
    const p = params as { projectPath?: string | null; chat?: boolean }
    const result = await listConfiguredPiSkills(p.projectPath ?? null, p.chat ?? false)
    sendJson(res, 200, result)
  } catch {
    sendJson(res, 200, [])
  }
}

async function channelInstallPiPackage(params: unknown, res: ServerResponse) {
  try {
    const { installPiPackage } = await import('../desktop/pi-packages/mutations.ts')
    const result = await installPiPackage(params as Record<string, unknown>)
    sendJson(res, 200, result)
  } catch {
    sendJson(res, 200, { ok: false, error: 'Install failed' })
  }
}

async function channelRemovePiPackage(params: unknown, res: ServerResponse) {
  try {
    const { removePiPackage } = await import('../desktop/pi-packages/mutations.ts')
    const result = await removePiPackage(params as Record<string, unknown>)
    sendJson(res, 200, result)
  } catch {
    sendJson(res, 200, { ok: false, error: 'Remove failed' })
  }
}

async function channelInstallPiSkill(params: unknown, res: ServerResponse) {
  try {
    const { installPiSkill } = await import('../desktop/skills/mutations.ts')
    const result = await installPiSkill(params as Record<string, unknown>)
    sendJson(res, 200, result)
  } catch {
    sendJson(res, 200, { ok: false, error: 'Install failed' })
  }
}

async function channelRemovePiSkill(params: unknown, res: ServerResponse) {
  try {
    const { removePiSkill } = await import('../desktop/skills/mutations.ts')
    const result = await removePiSkill(params as Record<string, unknown>)
    sendJson(res, 200, result)
  } catch {
    sendJson(res, 200, { ok: false, error: 'Remove failed' })
  }
}

// ── Dispatch table ────────────────────────────────────────────────────────────

type ChannelHandler = (params: unknown, res: ServerResponse) => Promise<void>

const CHANNEL_HANDLERS: Record<string, ChannelHandler> = {
  getShellState: channelGetShellState,
  getProjectThreads: channelGetProjectThreads,
  getInboxThreads: channelGetInboxThreads,
  getArchivedThreads: channelGetArchivedThreads,
  getThread: channelGetThread,
  getComposerState: channelGetComposerState,
  getComposerSlashCommands: channelGetComposerSlashCommands,
  getComposerSkills: channelStubArray,
  getProjectGitState: channelGetProjectGitState,
  getChatSidebarState: channelGetChatSidebarState,
  createChatGroup: channelCreateChatGroup,
  invokeAction: channelInvokeAction,
  listProjectDirectoryEntries: channelListProjectDirectoryEntries,
  listComposerAttachmentEntries: channelListComposerAttachmentEntries,
  searchComposerAttachmentEntries: channelSearchComposerAttachmentEntries,
  getAttachmentKindsForPaths: channelGetAttachmentKindsForPaths,
  pickComposerAttachments: channelStubArray,
  watchSession: channelStub,
  listTerminals: channelListTerminals,
  terminalOpen: channelTerminalOpen,
  terminalWrite: channelTerminalWrite,
  terminalResize: channelTerminalResize,
  terminalClose: channelTerminalClose,
  statTerminalSessionFile: channelTerminalSessionFileStat,
  getTerminalStatus: channelTerminalStatus,
  listArtifacts: channelListArtifacts,
  getArtifact: channelGetArtifact,
  updateArtifact: channelUpdateArtifact,
  editArtifact: channelEditArtifact,
  listArtifactVersions: channelListArtifactVersions,
  compileReactArtifact: channelCompileReactArtifact,
  getProjectUsageSummary: channelGetProjectUsageSummary,
  getProjectDiff: channelGetProjectDiff,
  getProjectDiffStats: channelGetProjectDiffStats,
  captureProjectDiffBaseline: channelCaptureProjectDiffBaseline,
  listProjectCommits: channelListProjectCommits,
  searchPiPackages: channelSearchPiPackages,
  getConfiguredPiPackages: channelGetConfiguredPiPackages,
  installPiPackage: channelInstallPiPackage,
  removePiPackage: channelRemovePiPackage,
  searchPiSkills: channelSearchPiSkills,
  getConfiguredPiSkills: channelGetConfiguredPiSkills,
  installPiSkill: channelInstallPiSkill,
  removePiSkill: channelRemovePiSkill,
  startSkillCreatorSession: channelStub,
  continueSkillCreatorSession: channelStub,
  closeSkillCreatorSession: channelStub,
  clearClipboardImages: channelStub,
  readClipboardSnapshot: channelStub,
  readClipboardFilePaths: channelStub,
  readClipboardImage: channelStub,
  openExternal: channelOpenOk,
  openPath: channelOpenOk,
  saveTextToDownloads: channelStub,
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  bridge: RuntimeBridge,
) {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const body = await readBody(req)
    const params = JSON.parse(body) as unknown

    if (url.pathname === '/api/action') {
      const { action, payload } = params as {
        action: string
        payload?: Record<string, unknown>
      }
      const result = await bridge.handleAction(action as never, (payload ?? {}) as never)
      sendJson(res, 200, result)
      return
    }

    const channel = url.pathname.replace('/api/', '')
    const handler = CHANNEL_HANDLERS[channel]
    if (handler) {
      await handler(params, res)
      return
    }

    sendJson(res, 200, null)
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
