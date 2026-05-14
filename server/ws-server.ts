import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocket, WebSocketServer } from 'ws'
import type { DesktopEvent } from '../shared/desktop-contracts.ts'
import type { TerminalEvent } from '../shared/terminal-contracts.ts'
import type { RuntimeBridge } from './runtime-bridge.js'

const WS_PATH = '/ws'
const WSS_HANDLER_KEY = '__howcode_ws_handler'

export function createWebSocketServer(server: Server, bridge: RuntimeBridge) {
  const wss = new WebSocketServer({ noServer: true })
  let unsubEvents: null | (() => void) = null
  let unsubTerminalEvents: null | (() => void) = null

  function sendToAll(data: string) {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    }
  }

  wss.on('connection', (ws: WebSocket) => {
    if (!unsubEvents) {
      unsubEvents = bridge.subscribeEvents((event: DesktopEvent) => {
        sendToAll(JSON.stringify(event))
      })
    }

    if (!unsubTerminalEvents) {
      import('../desktop/terminal/session-store.ts')
        .then(({ subscribeTerminalEvents }) => {
          unsubTerminalEvents = subscribeTerminalEvents((event: TerminalEvent) => {
            sendToAll(JSON.stringify(event))
          })
        })
        .catch(() => {
          // Terminal event subscription unavailable
        })
    }

    ws.send(JSON.stringify({ type: 'connected' }))

    ws.on('close', () => {
      if (wss.clients.size === 0) {
        if (unsubEvents) {
          unsubEvents()
          unsubEvents = null
        }
        if (unsubTerminalEvents) {
          unsubTerminalEvents()
          unsubTerminalEvents = null
        }
      }
    })
  })

  const upgradeHandler = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname !== WS_PATH) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  }

  const existing = (server as unknown as Record<string, unknown>)[WSS_HANDLER_KEY]
  if (existing) {
    server.off('upgrade', existing as (...args: unknown[]) => void)
  }
  ;(server as unknown as Record<string, unknown>)[WSS_HANDLER_KEY] = upgradeHandler
  server.on('upgrade', upgradeHandler)

  return wss
}
