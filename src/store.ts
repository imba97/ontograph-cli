import type {
  AggregateResult,
  Entity,
  Graph,
  PathResult,
  RelatedResult,
  Relation,
  SearchResult,
  StoreOptions,
  UserEntitySchema,
  UserRelationSchema
} from './types'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { consola } from 'consola'
import yaml from 'yaml'
import { buildEntityId, parseEntityId } from './utils'
import {
  getPresetArrayFields,
  validateEntity,
  validateEntityByUserSchema,
  validateRelation
} from './validator'

type EntityIndex = Record<string, string[]>

// Adjacency list for O(1) neighbor lookup
type AdjacencyList = Record<string, Array<{ rel: string, neighbor: string }>>
interface AdjacencyIndex {
  out: AdjacencyList
  in: AdjacencyList
}
const STORE_PATHS = {
  index: 'index.yaml',
  relations: 'relations.yaml',
  entitiesDir: 'entities'
} as const

export class OntologyStore {
  private dataDir: string
  private readOnly: boolean
  private strict: boolean

  // Cached views
  private graph: Graph | null = null
  private adj: AdjacencyIndex | null = null
  private warned = new Set<string>()

  constructor(options: StoreOptions) {
    this.dataDir = options.dataDir
    this.readOnly = options.readOnly ?? false
    this.strict = options.strict ?? false
    if (fs.existsSync(`${this.dataDir}.transaction.json`))
      throw new Error(`Unfinished graph transaction: ${this.dataDir}.transaction.json`)
    if (!this.readOnly)
      this.ensureDataDir()
  }

  // ── Path helpers ─────────────────────────────────────────────────────────────

  private indexPath(): string {
    return path.join(this.dataDir, STORE_PATHS.index)
  }

  private relationsPath(): string {
    return path.join(this.dataDir, STORE_PATHS.relations)
  }

  private entityPath(type: string, id: string): string {
    return path.join(this.dataDir, STORE_PATHS.entitiesDir, type, `${id}.yaml`)
  }

  private warnOnce(key: string, message: string): void {
    if (this.warned.has(key))
      return
    this.warned.add(key)
    consola.warn(message)
  }

  private readYaml<T>(filePath: string): T | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      return yaml.parse(raw) as T
    }
    catch (error) {
      if (this.strict)
        throw new Error(`Cannot read graph YAML: ${filePath}`, { cause: error })
      return null
    }
  }

  private writeYamlAtomic(filePath: string, data: unknown): void {
    this.assertWritable()
    const tmp = `${filePath}.${randomUUID()}.tmp`
    try {
      fs.writeFileSync(tmp, yaml.stringify(data), { flag: 'wx' })
      fs.renameSync(tmp, filePath)
    }
    finally {
      if (fs.existsSync(tmp))
        fs.unlinkSync(tmp)
    }
  }

  // ── Index I/O ────────────────────────────────────────────────────────────────

  private loadIndex(): EntityIndex {
    const filePath = this.indexPath()
    if (!fs.existsSync(filePath))
      return {}

    const parsed = this.readYaml<{ entities?: EntityIndex }>(filePath)
    if (!parsed || typeof parsed !== 'object') {
      if (this.strict)
        throw new Error(`Malformed graph index: ${filePath}`)
      this.warnOnce(`bad-index:${filePath}`, `Malformed index YAML, fallback to empty index: ${filePath}`)
      return {}
    }

    if (!parsed.entities || typeof parsed.entities !== 'object') {
      if (this.strict)
        throw new Error(`Malformed graph index: ${filePath}`)
      return {}
    }

    return parsed.entities
  }

  private saveIndex(index: EntityIndex): void {
    this.writeYamlAtomic(this.indexPath(), { entities: index })
  }

  private updateIndex(mutator: (index: EntityIndex) => void): void {
    const index = this.loadIndex()
    mutator(index)
    this.saveIndex(index)
  }

  // ── Adjacency list ───────────────────────────────────────────────────────────

  /** Build adjacency index from relations (or return cached). */
  private getAdj(): AdjacencyIndex {
    if (this.adj)
      return this.adj

    const graph = this.load()
    const out: AdjacencyList = {}
    const incoming: AdjacencyList = {}
    for (const r of graph.relations) {
      if (!out[r.from])
        out[r.from] = []
      out[r.from].push({ rel: r.rel, neighbor: r.to })

      if (!incoming[r.to])
        incoming[r.to] = []
      incoming[r.to].push({ rel: r.rel, neighbor: r.from })
    }
    this.adj = { out, in: incoming }
    return this.adj
  }

  /** Invalidate caches. Call after any write operation. */
  private invalidate(): void {
    this.graph = null
    this.adj = null
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  private load(): Graph {
    if (this.graph)
      return this.graph

    const index = this.loadIndex()
    const entities: Record<string, Entity> = {}
    const relations = this.loadRelations()

    for (const [type, ids] of Object.entries(index)) {
      for (const id of ids) {
        const filePath = this.entityPath(type, id)
        if (!fs.existsSync(filePath)) {
          if (this.strict)
            throw new Error(`Indexed entity file is missing: ${filePath}`)
          this.warnOnce(`missing-entity:${filePath}`, `Indexed entity file is missing, skipped: ${filePath}`)
          continue
        }

        const parsed = this.readYaml<Entity>(filePath)
        if (parsed && typeof parsed === 'object') {
          try {
            entities[buildEntityId(type, id)] = parsed
          }
          catch {
            this.warnOnce(`bad-entity-id:${type}:${id}`, `Invalid indexed entity id, skipped: ${type}/${id}`)
          }
        }
        else {
          if (this.strict)
            throw new Error(`Malformed entity YAML: ${filePath}`)
          this.warnOnce(`bad-entity:${filePath}`, `Malformed entity YAML, skipped: ${filePath}`)
        }
      }
    }

    this.graph = { entities, relations }
    if (this.strict) {
      for (const relation of relations) {
        if (!relation || typeof relation.from !== 'string' || typeof relation.to !== 'string' || typeof relation.rel !== 'string'
          || !entities[relation.from] || !entities[relation.to]) {
          throw new Error('Graph relation has a missing or invalid endpoint')
        }
      }
    }
    return this.graph
  }

  private loadRelations(): Relation[] {
    const relPath = this.relationsPath()
    if (!fs.existsSync(relPath))
      return []

    const parsed = this.readYaml<Relation[]>(relPath)
    if (!parsed || !Array.isArray(parsed)) {
      if (this.strict)
        throw new Error(`Malformed graph relations: ${relPath}`)
      this.warnOnce(`bad-relations:${relPath}`, `Malformed relations YAML, fallback to empty relations: ${relPath}`)
      return []
    }
    return parsed
  }

  private saveRelations(relations: Relation[]): void {
    this.writeYamlAtomic(this.relationsPath(), relations)
  }

  getGraph(): Graph {
    return this.load()
  }

  // ── Entity CRUD ─────────────────────────────────────────────────────────────

  addEntity(entityId: string, entity: Entity): void {
    this.assertWritable()
    const graph = this.load()
    const { type, id } = parseEntityId(entityId)

    if (entity.type !== type)
      throw new Error(`Entity type mismatch for "${entityId}": payload type is "${entity.type}", id type is "${type}"`)

    if (graph.entities[entityId])
      throw new Error(`Entity "${entityId}" already exists`)

    const errors = validateEntity(entity.type, entity)
    if (errors.length > 0) {
      const msgs = errors.map(e => `[${e.field}] ${e.message}`).join('; ')
      throw new Error(`Validation failed: ${msgs}`)
    }
    const customErrors = this.validateCustomEntity(entity.type, entity)
    if (customErrors.length > 0) {
      const msgs = customErrors.map(e => `[${e.field}] ${e.message}`).join('; ')
      throw new Error(`Validation failed: ${msgs}`)
    }

    const filePath = this.entityPath(type, id)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, yaml.stringify(entity), { flag: 'wx' })

    // Incrementally update index
    this.updateIndex((index) => {
      if (!index[type])
        index[type] = []
      if (!index[type].includes(id))
        index[type].push(id)
    })

    this.invalidate()
  }

  updateEntity(entityId: string, patch: Partial<Entity>): void {
    this.assertWritable()
    const { type, id } = parseEntityId(entityId)
    const graph = this.load()
    const existing = graph.entities[entityId]

    if (!existing)
      throw new Error(`Entity "${entityId}" not found`)

    if (patch.type && patch.type !== existing.type)
      throw new Error(`Entity "${entityId}" type cannot be changed`)

    const merged: Entity = {
      ...existing,
      ...patch,
      type: existing.type
    }

    const errors = validateEntity(merged.type, merged)
    if (errors.length > 0) {
      const msgs = errors.map(e => `[${e.field}] ${e.message}`).join('; ')
      throw new Error(`Validation failed: ${msgs}`)
    }
    const customErrors = this.validateCustomEntity(merged.type, merged)
    if (customErrors.length > 0) {
      const msgs = customErrors.map(e => `[${e.field}] ${e.message}`).join('; ')
      throw new Error(`Validation failed: ${msgs}`)
    }

    const filePath = this.entityPath(type, id)
    this.writeYamlAtomic(filePath, merged)

    this.invalidate()
  }

  removeEntity(entityId: string): void {
    this.assertWritable()
    const { type, id } = parseEntityId(entityId)
    const graph = this.load()

    if (!graph.entities[entityId])
      throw new Error(`Entity "${entityId}" not found`)
    const filePath = this.entityPath(type, id)
    if (fs.existsSync(filePath))
      fs.unlinkSync(filePath)

    // Incrementally update index
    this.updateIndex((index) => {
      if (!index[type])
        return
      index[type] = index[type].filter(i => i !== id)
      if (index[type].length === 0)
        delete index[type]
    })

    // Remove relations involving this entity
    this.saveRelations(graph.relations.filter(r => r.from !== entityId && r.to !== entityId))

    this.invalidate()
  }

  // ── Relation CRUD ───────────────────────────────────────────────────────────

  addRelation(from: string, rel: string, to: string): void {
    this.assertWritable()
    parseEntityId(from)
    parseEntityId(to)
    const graph = this.load()
    const userRelationSchemas = this.loadUserRelationSchemas()

    const error = validateRelation(from, to, rel, graph, userRelationSchemas)
    if (error)
      throw new Error(error.message)

    const exists = graph.relations.some(r => r.from === from && r.rel === rel && r.to === to)
    if (!exists) {
      this.saveRelations([...graph.relations, { from, rel, to }])
      this.invalidate()
    }
  }

  removeRelation(from: string, rel: string, to: string): void {
    this.assertWritable()
    parseEntityId(from)
    parseEntityId(to)
    const graph = this.load()
    if (!graph.entities[from])
      throw new Error(`Source entity "${from}" not found`)
    if (!graph.entities[to])
      throw new Error(`Target entity "${to}" not found`)

    const exists = graph.relations.some(r => r.from === from && r.rel === rel && r.to === to)
    if (!exists)
      throw new Error(`Relation not found: ${from} --${rel}--> ${to}`)

    this.saveRelations(graph.relations.filter(r => !(r.from === from && r.rel === rel && r.to === to)))
    this.invalidate()
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
    parseEntityId(id)
    const adj = this.getAdj()
    const graph = this.load()
    if (!graph.entities[id])
      throw new Error(`Entity "${id}" not found`)
    const results: RelatedResult[] = []

    // Outgoing
    for (const { rel: r, neighbor } of adj.out[id] ?? []) {
      if (!rel || rel === r) {
        const entity = graph.entities[neighbor]
        if (!entity) {
          this.warnOnce(`missing-related:${id}:${r}:${neighbor}`, `Skipping relation with missing entity: ${id} --${r}--> ${neighbor}`)
          continue
        }
        results.push({ id: neighbor, entity, rel: r, direction: 'out' })
      }
    }

    // Incoming
    for (const { rel: r, neighbor } of adj.in[id] ?? []) {
      if (!rel || rel === r) {
        const entity = graph.entities[neighbor]
        if (!entity) {
          this.warnOnce(`missing-related:${neighbor}:${r}:${id}`, `Skipping relation with missing entity: ${neighbor} --${r}--> ${id}`)
          continue
        }
        results.push({ id: neighbor, entity, rel: r, direction: 'in' })
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
    parseEntityId(from)
    parseEntityId(to)
    const graph = this.load()

    if (!graph.entities[from] || !graph.entities[to])
      throw new Error(`Entity not found: "${from}" or "${to}"`)
    if (from === to)
      return { path: [from], relations: [] }

    const adj = this.getAdj()
    interface Frame { id: string, path: string[] }
    const queue: Frame[] = [{ id: from, path: [from] }]
    let queueHead = 0
    const visited = new Set<string>([from])

    while (queueHead < queue.length) {
      const frame = queue[queueHead]!
      queueHead += 1

      for (const { rel: _rel, neighbor } of adj.out[frame.id] ?? []) {
        if (visited.has(neighbor))
          continue

        const newPath = [...frame.path, neighbor]

        if (neighbor === to) {
          const pathRelations: Relation[] = []
          for (let i = 1; i < newPath.length; i++) {
            const prev = newPath[i - 1]
            const curr = newPath[i]
            const relEntry = adj.out[prev]?.find(n => n.neighbor === curr)
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

  defineRelationType(key: string, schema: UserRelationSchema, replace = false): void {
    this.assertWritable()
    if (!/^[a-z][\w-]*$/i.test(key) || !schema.name.trim() || !schema.fromTypes.length || !schema.toTypes.length)
      throw new Error('Invalid relation type definition')
    const directory = path.join(this.dataDir, 'user-relations')
    const file = path.join(directory, `${key}.yaml`)
    fs.mkdirSync(directory, { recursive: true })
    if (replace) {
      if (!fs.existsSync(file))
        throw new Error(`Relation type not found: ${key}`)
      this.writeYamlAtomic(file, schema)
    }
    else {
      fs.writeFileSync(file, yaml.stringify(schema), { flag: 'wx' })
    }
  }

  /** The caller serializes writers. All mutations are staged before replacing the graph directory. */
  transaction<T>(action: (store: OntologyStore) => T): T {
    this.assertWritable()
    const target = path.resolve(this.dataDir)
    const stage = `${target}.${randomUUID()}.tmp`
    const backup = `${target}.${randomUUID()}.tmp`
    const journal = `${target}.transaction.json`
    let moved = false
    let installed = false
    try {
      fs.cpSync(target, stage, { recursive: true, errorOnExist: true, force: false })
      const transaction = new OntologyStore({ dataDir: stage, strict: this.strict })
      const result = action(transaction)
      if (result && typeof (result as { then?: unknown }).then === 'function')
        throw new Error('Graph transaction callback must be synchronous')
      transaction.getGraph()
      fs.writeFileSync(journal, JSON.stringify({ target, stage, backup }), { flag: 'wx' })
      fs.renameSync(target, backup)
      moved = true
      fs.renameSync(stage, target)
      installed = true
      this.invalidate()
      fs.unlinkSync(journal)
      return result
    }
    catch (error) {
      if (moved && !installed)
        fs.renameSync(backup, target)
      if (fs.existsSync(journal) && (!moved || !installed))
        fs.unlinkSync(journal)
      throw error
    }
    finally {
      if (fs.existsSync(stage))
        fs.rmSync(stage, { recursive: true })
      if (installed && fs.existsSync(backup))
        fs.rmSync(backup, { recursive: true })
    }
  }

  private assertWritable(): void {
    if (this.readOnly)
      throw new Error('Graph is read only')
  }

  getArrayFieldsForType(type: string): Set<string> {
    const arrayFields = new Set<string>(getPresetArrayFields(type))
    const schema = this.loadUserEntitySchema(type)
    if (!schema?.fields)
      return arrayFields

    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      if (fieldDef.type === 'array')
        arrayFields.add(fieldName)
    }

    return arrayFields
  }

  getNumberFieldsForType(type: string): Set<string> {
    const numberFields = new Set<string>()
    const schema = this.loadUserEntitySchema(type)
    if (!schema?.fields)
      return numberFields

    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      if (fieldDef.type === 'number')
        numberFields.add(fieldName)
    }

    return numberFields
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir))
      fs.mkdirSync(this.dataDir, { recursive: true })

    const entitiesDir = path.join(this.dataDir, STORE_PATHS.entitiesDir)
    if (!fs.existsSync(entitiesDir))
      fs.mkdirSync(entitiesDir, { recursive: true })
  }

  private loadUserEntitySchema(type: string): UserEntitySchema | null {
    const schemaPath = path.join(this.dataDir, 'user-entities', `${type}.yaml`)
    if (!fs.existsSync(schemaPath))
      return null
    return this.readYaml<UserEntitySchema>(schemaPath)
  }

  private loadUserRelationSchemas(): Record<string, UserRelationSchema> {
    const relationDir = path.join(this.dataDir, 'user-relations')
    if (!fs.existsSync(relationDir))
      return {}

    const schemas: Record<string, UserRelationSchema> = {}
    for (const file of fs.readdirSync(relationDir)) {
      if (!file.endsWith('.yaml'))
        continue

      const schemaPath = path.join(relationDir, file)
      const parsed = this.readYaml<UserRelationSchema>(schemaPath)
      if (!parsed || !Array.isArray(parsed.fromTypes) || !Array.isArray(parsed.toTypes)) {
        this.warnOnce(`bad-user-relation:${schemaPath}`, `Malformed user relation YAML, skipped: ${schemaPath}`)
        continue
      }

      const relName = file.replace(/\.yaml$/, '')
      schemas[relName] = parsed
    }

    return schemas
  }

  private validateCustomEntity(type: string, entity: Partial<Entity>) {
    const schema = this.loadUserEntitySchema(type)
    if (!schema)
      return []
    return validateEntityByUserSchema(entity, schema)
  }
}
