type MessageHandler = (data: unknown) => void
type CloseHandler = (event: CloseEvent) => void

export type WsConnection = {
  send: (data: unknown) => void
  onMessage: (handler: MessageHandler) => void
  onClose: (handler: CloseHandler) => void
  close: () => void
}

export function createWsConnection(url: string): WsConnection {
  let ws: WebSocket | null = null
  const messageHandlers = new Set<MessageHandler>()
  const closeHandlers = new Set<CloseHandler>()
  let reconnectAttempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let closed = false
  const sendQueue: string[] = []

  function scheduleReconnect() {
    if (closed) return
    const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000)
    reconnectAttempts++
    reconnectTimer = setTimeout(connect, delay)
  }

  function connect() {
    if (closed) return

    try {
      ws = new WebSocket(url)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      reconnectAttempts = 0
      while (sendQueue.length > 0) {
        ws?.send(sendQueue.shift() as string)
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string)
        for (const handler of messageHandlers) {
          handler(data)
        }
      } catch {
        // ignore non-JSON messages
      }
    }

    ws.onclose = (event) => {
      for (const handler of closeHandlers) {
        handler(event)
      }
      if (!closed) {
        scheduleReconnect()
      }
    }

    ws.onerror = () => {
      // onclose will fire after onerror
    }
  }

  connect()

  return {
    send(data: unknown) {
      const msg = JSON.stringify(data)
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(msg)
      } else {
        sendQueue.push(msg)
      }
    },
    onMessage(handler: MessageHandler) {
      messageHandlers.add(handler)
    },
    onClose(handler: CloseHandler) {
      closeHandlers.add(handler)
    },
    close() {
      closed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      messageHandlers.clear()
      closeHandlers.clear()
      ws?.close()
      ws = null
    },
  }
}
