import type {
  AggregateResult,
  Entity,
  Graph,
  PathResult,
  RelatedResult,
  Relation,
  SearchResult,
  StoreOptions
} from './types'
import fs from 'node:fs'
import path from 'node:path'
import { consola } from 'consola'
import yaml from 'yaml'
import { parseEntityId } from './utils'
import { validateEntity, validateRelation } from './validator'

type EntityIndex = Record<string, string[]>

// Adjacency list for O(1) neighbor lookup
type AdjacencyList = Record<string, Array<{ rel: string, neighbor: string }>>
const STORE_PATHS = {
  index: 'index.yaml',
  relations: 'relations.yaml',
  entitiesDir: 'entities'
} as const

export class OntologyStore {
  private dataDir: string

  // Cached views
  #graph: Graph | null = null
  #adj: AdjacencyList | null = null
  #warned = new Set<string>()

  constructor(options: StoreOptions) {
    this.dataDir = options.dataDir
    this.#ensureDataDir()
  }

  // ── Path helpers ─────────────────────────────────────────────────────────────

  #indexPath(): string {
    return path.join(this.dataDir, STORE_PATHS.index)
  }

  #relationsPath(): string {
    return path.join(this.dataDir, STORE_PATHS.relations)
  }

  private entityPath(type: string, id: string): string {
    return path.join(this.dataDir, STORE_PATHS.entitiesDir, type, `${id}.yaml`)
  }

  #warnOnce(key: string, message: string): void {
    if (this.#warned.has(key))
      return
    this.#warned.add(key)
    consola.warn(message)
  }

  #readYaml<T>(filePath: string): T | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      return yaml.parse(raw) as T
    }
    catch {
      return null
    }
  }

  #writeYamlAtomic(filePath: string, data: unknown): void {
    const tmp = `${filePath}.tmp`
    fs.writeFileSync(tmp, yaml.stringify(data), 'utf8')
    fs.renameSync(tmp, filePath)
  }

  // ── Index I/O ────────────────────────────────────────────────────────────────

  #loadIndex(): EntityIndex {
    const filePath = this.#indexPath()
    if (!fs.existsSync(filePath))
      return {}

    const parsed = this.#readYaml<{ entities?: EntityIndex }>(filePath)
    if (!parsed || typeof parsed !== 'object') {
      this.#warnOnce(`bad-index:${filePath}`, `Malformed index YAML, fallback to empty index: ${filePath}`)
      return {}
    }

    if (!parsed.entities || typeof parsed.entities !== 'object')
      return {}

    return parsed.entities
  }

  #saveIndex(index: EntityIndex): void {
    this.#writeYamlAtomic(this.#indexPath(), { entities: index })
  }

  // ── Adjacency list ───────────────────────────────────────────────────────────

  /** Build adjacency list from relations (or return cached). */
  #getAdj(): AdjacencyList {
    if (this.#adj)
      return this.#adj

    const graph = this.load()
    const adj: AdjacencyList = {}
    for (const r of graph.relations) {
      if (!adj[r.from])
        adj[r.from] = []
      adj[r.from].push({ rel: r.rel, neighbor: r.to })
    }
    this.#adj = adj
    return adj
  }

  /** Invalidate caches. Call after any write operation. */
  #invalidate(): void {
    this.#graph = null
    this.#adj = null
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  private load(): Graph {
    if (this.#graph)
      return this.#graph

    const index = this.#loadIndex()
    const entities: Record<string, Entity> = {}
    const relations = this.#loadRelations()

    for (const [type, ids] of Object.entries(index)) {
      for (const id of ids) {
        const filePath = this.entityPath(type, id)
        if (!fs.existsSync(filePath)) {
          this.#warnOnce(`missing-entity:${filePath}`, `Indexed entity file is missing, skipped: ${filePath}`)
          continue
        }

        const parsed = this.#readYaml<Entity>(filePath)
        if (parsed && typeof parsed === 'object') {
          entities[`${type}:${id}`] = parsed
        }
        else {
          this.#warnOnce(`bad-entity:${filePath}`, `Malformed entity YAML, skipped: ${filePath}`)
        }
      }
    }

    this.#graph = { entities, relations }
    return this.#graph
  }

  #loadRelations(): Relation[] {
    const relPath = this.#relationsPath()
    if (!fs.existsSync(relPath))
      return []

    const parsed = this.#readYaml<Relation[]>(relPath)
    if (!parsed || !Array.isArray(parsed)) {
      this.#warnOnce(`bad-relations:${relPath}`, `Malformed relations YAML, fallback to empty relations: ${relPath}`)
      return []
    }
    return parsed
  }

  #saveRelations(relations: Relation[]): void {
    this.#writeYamlAtomic(this.#relationsPath(), relations)
  }

  getGraph(): Graph {
    return this.load()
  }

  // ── Entity CRUD ─────────────────────────────────────────────────────────────

  addEntity(fullId: string, entity: Entity): void {
    const graph = this.load()

    if (graph.entities[fullId])
      throw new Error(`Entity "${fullId}" already exists`)

    const errors = validateEntity(entity.type, entity)
    if (errors.length > 0) {
      const msgs = errors.map(e => `[${e.field}] ${e.message}`).join('; ')
      throw new Error(`Validation failed: ${msgs}`)
    }

    const { type, id } = parseEntityId(fullId)
    const filePath = this.entityPath(type, id)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, yaml.stringify(entity), 'utf8')

    // Incrementally update index
    const index = this.#loadIndex()
    if (!index[type])
      index[type] = []
    if (!index[type].includes(id))
      index[type].push(id)
    this.#saveIndex(index)

    this.#invalidate()
  }

  removeEntity(fullId: string): void {
    const graph = this.load()

    if (!graph.entities[fullId])
      throw new Error(`Entity "${fullId}" not found`)

    const { type, id } = parseEntityId(fullId)
    const filePath = this.entityPath(type, id)
    if (fs.existsSync(filePath))
      fs.unlinkSync(filePath)

    // Incrementally update index
    const index = this.#loadIndex()
    if (index[type])
      index[type] = index[type].filter(i => i !== id)
    this.#saveIndex(index)

    // Remove relations involving this entity
    this.#saveRelations(graph.relations.filter(r => r.from !== fullId && r.to !== fullId))

    this.#invalidate()
  }

  // ── Relation CRUD ───────────────────────────────────────────────────────────

  addRelation(from: string, rel: string, to: string): void {
    const graph = this.load()

    const error = validateRelation(from, to, rel, graph)
    if (error)
      throw new Error(error.message)

    const exists = graph.relations.some(r => r.from === from && r.rel === rel && r.to === to)
    if (!exists) {
      this.#saveRelations([...graph.relations, { from, rel, to }])
      this.#invalidate()
    }
  }

  removeRelation(from: string, rel: string, to: string): void {
    const graph = this.load()
    this.#saveRelations(graph.relations.filter(r => !(r.from === from && r.rel === rel && r.to === to)))
    this.#invalidate()
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  listTypes(): string[] {
    const graph = this.load()
    return [...new Set(Object.values(graph.entities).map(e => e.type))].sort()
  }

  listEntities(type?: string): Array<{ id: string, entity: Entity }> {
    const graph = this.load()
    const entries = Object.entries(graph.entities)
    if (!type)
      return entries.map(([id, entity]) => ({ id, entity }))
    return entries
      .filter(([, entity]) => entity.type === type)
      .map(([id, entity]) => ({ id, entity }))
  }

  related(id: string, rel?: string): RelatedResult[] {
    const adj = this.#getAdj()
    const graph = this.load()
    const results: RelatedResult[] = []

    // Outgoing
    for (const { rel: r, neighbor } of adj[id] ?? []) {
      if (!rel || rel === r)
        results.push({ id: neighbor, entity: graph.entities[neighbor]!, rel: r, direction: 'out' })
    }

    // Incoming — scan adj for edges pointing TO id
    for (const [from, edges] of Object.entries(adj)) {
      if (from === id)
        continue
      for (const { rel: r, neighbor } of edges) {
        if (neighbor === id && (!rel || rel === r))
          results.push({ id: from, entity: graph.entities[from]!, rel: r, direction: 'in' })
      }
    }

    return results
  }

  search(query: string, type?: string): SearchResult[] {
    const graph = this.load()
    const lower = query.toLowerCase()

    return Object.entries(graph.entities)
      .filter(([id, entity]) => {
        if (type && entity.type !== type)
          return false
        return id.toLowerCase().includes(lower) || String(entity.name).toLowerCase().includes(lower)
      })
      .map(([id, entity]) => ({ id, entity }))
  }

  // ── Advanced Queries ────────────────────────────────────────────────────────

  aggregate(type?: string, field: string = 'type'): AggregateResult[] {
    const graph = this.load()
    const counts: Record<string, number> = {}

    for (const entity of Object.values(graph.entities)) {
      if (type && entity.type !== type)
        continue
      const value = String(entity[field] ?? '_none_')
      counts[value] = (counts[value] ?? 0) + 1
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }))
  }

  findPath(from: string, to: string, maxDepth: number = 5): PathResult | null {
    const graph = this.load()

    if (!graph.entities[from] || !graph.entities[to])
      throw new Error(`Entity not found: "${from}" or "${to}"`)
    if (from === to)
      return { path: [from], relations: [] }

    const adj = this.#getAdj()
    interface Frame { id: string, path: string[] }
    const queue: Frame[] = [{ id: from, path: [from] }]
    const visited = new Set<string>([from])

    while (queue.length > 0) {
      const frame = queue.shift()!

      for (const { rel: _rel, neighbor } of adj[frame.id] ?? []) {
        if (visited.has(neighbor))
          continue

        const newPath = [...frame.path, neighbor]

        if (neighbor === to) {
          const pathRelations: Relation[] = []
          for (let i = 1; i < newPath.length; i++) {
            const prev = newPath[i - 1]
            const curr = newPath[i]
            const relEntry = adj[prev]?.find(n => n.neighbor === curr)
            if (relEntry)
              pathRelations.push({ from: prev, rel: relEntry.rel, to: curr })
          }
          return { path: newPath, relations: pathRelations }
        }

        if (newPath.length <= maxDepth) {
          visited.add(neighbor)
          queue.push({ id: neighbor, path: newPath })
        }
      }
    }

    return null
  }

  query(predicate: (entity: Entity, id: string) => boolean): SearchResult[] {
    const graph = this.load()
    return Object.entries(graph.entities)
      .filter(([id, entity]) => predicate(entity, id))
      .map(([id, entity]) => ({ id, entity }))
  }

  getDataDir(): string {
    return this.dataDir
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  #ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir))
      fs.mkdirSync(this.dataDir, { recursive: true })

    const entitiesDir = path.join(this.dataDir, STORE_PATHS.entitiesDir)
    if (!fs.existsSync(entitiesDir))
      fs.mkdirSync(entitiesDir, { recursive: true })
  }
}
