import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import fs from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OntologyStore } from '../store'
import { loadViewerConfig } from './config'
import { projectViewerGraph } from './projection'

export interface ViewerServerOptions {
  dataDir: string
  host?: string
  port?: number
  assetsDir?: string
  configPath?: string
}

export interface ViewerServer {
  server: Server
  url: string
  close: () => Promise<void>
}

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
}

function defaultAssetsDir(): string {
  return fileURLToPath(new URL('./viewer/', import.meta.url))
}

function sendJson(response: import('node:http').ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8'
  })
  response.end(JSON.stringify(body))
}

export async function startViewerServer(options: ViewerServerOptions): Promise<ViewerServer> {
  const host = options.host ?? '127.0.0.1'
  const assetsDir = path.resolve(options.assetsDir ?? defaultAssetsDir())
  const viewerConfig = loadViewerConfig(options.dataDir, options.configPath)
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? host}`)

    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed' })
      return
    }

    if (url.pathname === '/api/graph') {
      try {
        const store = new OntologyStore({ dataDir: options.dataDir, readOnly: true, strict: true })
        sendJson(response, 200, projectViewerGraph(store.getGraph(), undefined, viewerConfig))
      }
      catch (error) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
      }
      return
    }

    if (url.pathname === '/api/config') {
      sendJson(response, 200, viewerConfig)
      return
    }

    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    const filePath = path.resolve(assetsDir, relative)
    if (filePath !== assetsDir && !filePath.startsWith(`${assetsDir}${path.sep}`)) {
      sendJson(response, 403, { error: 'Forbidden' })
      return
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      sendJson(response, 404, { error: 'Not found' })
      return
    }

    response.writeHead(200, {
      'Cache-Control': relative === 'index.html' ? 'no-store' : 'public, max-age=31536000, immutable',
      'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream'
    })
    fs.createReadStream(filePath).pipe(response)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 0, host, () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address() as AddressInfo
  return {
    server,
    url: `http://${host}:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
}
