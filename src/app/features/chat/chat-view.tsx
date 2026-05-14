import { ThreadTimeline } from '../../components/workspace/thread/thread-timeline'
import { ThreadTimelineSkeleton } from '../../components/workspace/thread/thread-timeline-skeleton'
import type { Message } from '../../types'

type ChatViewProps = {
  messages: Message[]
  previousMessageCount: number
  isStreaming: boolean
  isCompacting: boolean
  composerLayoutVersion: number
  composerOverlayHeight?: number
  loading?: boolean
  onLoadEarlierMessages: () => void
}

export function ChatView({
  messages,
  previousMessageCount,
  isStreaming,
  isCompacting,
  composerLayoutVersion,
  composerOverlayHeight = 0,
  loading = false,
  onLoadEarlierMessages,
}: ChatViewProps) {
  if (loading) {
    return <ThreadTimelineSkeleton composerOverlayHeight={composerOverlayHeight} />
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center pb-8">
        <img src="/android-icon-192x192.png" alt="" className="h-24 w-24 select-none opacity-40" />
      </div>
    )
  }

  return (
    <ThreadTimeline
      messages={messages}
      previousMessageCount={previousMessageCount}
      isStreaming={isStreaming}
      isCompacting={isCompacting}
      composerLayoutVersion={composerLayoutVersion}
      composerOverlayHeight={composerOverlayHeight}
      onLoadEarlierMessages={() => {
        if (previousMessageCount === 0) {
          return
        }

        onLoadEarlierMessages()
      }}
    />
  )
}
