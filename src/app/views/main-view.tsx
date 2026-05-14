import { ViewShell } from '../components/common/view-shell'

type MainViewProps = {
  activeView:
    | 'inbox'
    | 'code'
    | 'thread'
    | 'gitops'
    | 'archived'
    | 'settings'
    | 'extensions'
    | 'skills'
}

export function MainView({ activeView }: MainViewProps) {
  return (
    <ViewShell maxWidthClassName="max-w-[760px]">
      <div className="text-[color:var(--muted)]">Unknown view: {activeView}</div>
    </ViewShell>
  )
}
