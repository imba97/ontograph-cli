import { consola } from 'consola'
import { openBrowser } from '../viewer/open-browser'
import { startViewerServer } from '../viewer/server'

export interface InspectOptions {
  dataDir: string
  host?: string
  port?: number
  open?: boolean
  focus?: string
  configPath?: string
}

export async function inspectGraph(options: InspectOptions): Promise<void> {
  if (options.host && !['127.0.0.1', 'localhost', '::1'].includes(options.host))
    consola.warn(`Inspector is exposed on ${options.host}. The viewer has no authentication.`)

  const viewer = await startViewerServer(options)
  const url = options.focus
    ? `${viewer.url}/#node=${encodeURIComponent(options.focus)}`
    : viewer.url

  consola.success(`Ontology inspector: ${url}`)
  if (options.open !== false)
    openBrowser(url)
}
