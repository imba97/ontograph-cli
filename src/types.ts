// ── User Schema Types ─────────────────────────────────────────────────────────

export interface UserEntityField {
  type: 'string' | 'number' | 'array'
  required?: boolean
  enum?: string[]
}

export interface UserEntitySchema {
  name: string
  description?: string
  fields: Record<string, UserEntityField>
}

export interface UserRelationSchema {
  name: string
  description?: string
  fromTypes: string[]
  toTypes: string[]
}

// ── Core Types ────────────────────────────────────────────────────────────────

export interface Entity {
  type: string
  name: string
  [key: string]: unknown
}

export interface Relation {
  from: string
  rel: string
  to: string
}

export interface Graph {
  entities: Record<string, Entity>
  relations: Relation[]
}

export interface SearchResult {
  id: string
  entity: Entity
}

export interface RelatedResult {
  id: string
  entity: Entity
  rel: string
  direction: 'out' | 'in'
}

export interface StoreOptions {
  dataDir: string
}

// ── Aggregate Result ─────────────────────────────────────────────────────────

export interface AggregateResult {
  key: string
  count: number
}

// ── Path Result ─────────────────────────────────────────────────────────────

export interface PathResult {
  path: string[]
  relations: Relation[]
}
