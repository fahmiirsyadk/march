import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { handleApiRequest } from './api-handler.js'
import { createRuntimeBridge } from './runtime-bridge.js'
import { createWebSocketServer } from './ws-server.js'

const PORT = Number(process.env.HOWCODE_SERVER_PORT) || 39218
const isProd = process.env.NODE_ENV === 'production'

const runtimeBridge = createRuntimeBridge()

const distDir = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  '..',
  'dist',
)

function serveStatic(res: http.ServerResponse, filePath: string) {
  try {
    const data = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
      '.json': 'application/json',
      '.wasm': 'application/wasm',
    }
    res.writeHead(200, {
      'content-type': mimeTypes[ext] ?? 'application/octet-stream',
    })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end()
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type, authorization')
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (url.pathname.startsWith('/api/') && req.method === 'POST') {
    await handleApiRequest(req, res, runtimeBridge)
    return
  }

  if (isProd) {
    const staticPath = url.pathname === '/' ? '/index.html' : url.pathname
    serveStatic(res, path.join(distDir, staticPath))
    return
  }

  res.writeHead(404)
  res.end()
})

createWebSocketServer(server, runtimeBridge)

server.listen(PORT, '127.0.0.1', () => {
  console.log(`howcode server running on http://127.0.0.1:${PORT}`)
})

process.on('SIGTERM', () => {
  runtimeBridge.dispose()
  server.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  runtimeBridge.dispose()
  server.close()
  process.exit(0)
})
