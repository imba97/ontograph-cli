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
import yaml from 'yaml'
import { parseEntityId } from './utils'
import { validateEntity, validateRelation } from './validator'

type EntityIndex = Record<string, string[]>

// Adjacency list for O(1) neighbor lookup
type AdjacencyList = Record<string, Array<{ rel: string, neighbor: string }>>

export class OntologyStore {
  private dataDir: string
  private indexPath: string

  // Cached views
  #graph: Graph | null = null
  #adj: AdjacencyList | null = null

  constructor(options: StoreOptions) {
    this.dataDir = options.dataDir
    this.indexPath = path.join(this.dataDir, 'index.yaml')
    this.#ensureDataDir()
  }

  // ── Path helpers ─────────────────────────────────────────────────────────────

  private entityPath(type: string, id: string): string {
    return path.join(this.dataDir, 'entities', type, `${id}.yaml`)
  }

  // ── Index I/O ────────────────────────────────────────────────────────────────

  #loadIndex(): EntityIndex {
    if (!fs.existsSync(this.indexPath))
      return {}

    try {
      const raw = fs.readFileSync(this.indexPath, 'utf8')
      return (yaml.parse(raw) as { entities: EntityIndex }).entities ?? {}
    }
    catch {
      return {}
    }
  }

  #saveIndex(index: EntityIndex): void {
    const tmp = `${this.indexPath}.tmp`
    fs.writeFileSync(tmp, yaml.stringify({ entities: index }), 'utf8')
    fs.renameSync(tmp, this.indexPath)
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
        if (!fs.existsSync(filePath))
          continue

        try {
          const raw = fs.readFileSync(filePath, 'utf8')
          entities[`${type}:${id}`] = yaml.parse(raw) as Entity
        }
        catch {
          // Skip malformed files
        }
      }
    }

    this.#graph = { entities, relations }
    return this.#graph
  }

  #loadRelations(): Relation[] {
    const relPath = path.join(this.dataDir, 'relations.yaml')
    if (!fs.existsSync(relPath))
      return []

    try {
      return yaml.parse(fs.readFileSync(relPath, 'utf8')) as Relation[]
    }
    catch {
      return []
    }
  }

  #saveRelations(relations: Relation[]): void {
    const relPath = path.join(this.dataDir, 'relations.yaml')
    const tmp = `${relPath}.tmp`
    fs.writeFileSync(tmp, yaml.stringify(relations), 'utf8')
    fs.renameSync(tmp, relPath)
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
  }
}
