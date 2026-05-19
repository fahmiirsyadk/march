import { ThreadTimeline } from '../components/workspace/thread/thread-timeline'
import { ThreadTimelineSkeleton } from '../components/workspace/thread/thread-timeline-skeleton'
import type { DesktopActionInvoker } from '../desktop/types'
import type { Message } from '../types'

type ThreadViewProps = {
  sessionPath: string | null
  messages: Message[]
  previousMessageCount: number
  isStreaming: boolean
  isCompacting: boolean
  composerLayoutVersion: number
  composerOverlayHeight?: number
  loading?: boolean
  onAction: DesktopActionInvoker
  onLoadEarlierMessages: () => void
}

export function ThreadView({
  sessionPath,
  messages,
  previousMessageCount,
  isStreaming,
  isCompacting,
  composerLayoutVersion,
  composerOverlayHeight = 0,
  loading = false,
  onAction,
  onLoadEarlierMessages,
}: ThreadViewProps) {
  if (loading) {
    return <ThreadTimelineSkeleton composerOverlayHeight={composerOverlayHeight} />
  }

  if (messages.length === 0) {
    return <div className="h-full" />
  }

  return (
    <ThreadTimeline
      sessionPath={sessionPath}
      messages={messages}
      previousMessageCount={previousMessageCount}
      isStreaming={isStreaming}
      isCompacting={isCompacting}
      composerLayoutVersion={composerLayoutVersion}
      composerOverlayHeight={composerOverlayHeight}
      onAction={onAction}
      onLoadEarlierMessages={() => {
        if (previousMessageCount === 0) {
          return
        }

        onLoadEarlierMessages()
      }}
    />
  )
}
