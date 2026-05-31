import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import yaml from 'yaml'
import { OntologyStore } from '../src/store'

let counter = 0

function createStore(): OntologyStore {
  counter += 1
  const testDir = path.join(os.tmpdir(), `ontograph-cli-test-${Date.now()}-${counter}`)
  return new OntologyStore({ dataDir: testDir })
}

describe('ontographStore', () => {
  // ── Entity CRUD ─────────────────────────────────────────────────────────────

  it('should add and retrieve entities', () => {
    const store = createStore()
    store.addEntity('person:test', { type: 'person', name: 'Test User' })

    const graph = store.getGraph()
    expect(graph.entities['person:test']).toEqual({ type: 'person', name: 'Test User' })
  })

  it('should persist entity using YAML file layout', () => {
    const store = createStore()
    store.addEntity('person:yaml-layout', { type: 'person', name: 'YAML Layout' })

    const dataDir = store.getDataDir()
    const indexPath = path.join(dataDir, 'index.yaml')
    const entityPath = path.join(dataDir, 'entities', 'person', 'yaml-layout.yaml')

    expect(fs.existsSync(indexPath)).toBe(true)
    expect(fs.existsSync(entityPath)).toBe(true)

    const indexRaw = fs.readFileSync(indexPath, 'utf8')
    const parsed = yaml.parse(indexRaw) as { entities?: Record<string, string[]> }
    expect(parsed.entities?.person).toContain('yaml-layout')
  })

  it('should throw on duplicate entity', () => {
    const store = createStore()
    store.addEntity('person:test', { type: 'person', name: 'Test User' })
    expect(() => {
      store.addEntity('person:test', { type: 'person', name: 'Duplicate' })
    }).toThrow('already exists')
  })

  it('should validate entity against schema', () => {
    const store = createStore()
    expect(() => {
      // name is required, missing → should throw
      store.addEntity('project:bad', { type: 'project', name: '' })
    }).toThrow('Validation failed')
  })

  it('should remove entity and cascading relations', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('project:b', { type: 'project', name: 'Project B' })
    store.addRelation('person:a', 'owns', 'project:b')

    store.removeEntity('person:a')

    const graph = store.getGraph()
    expect(graph.entities['person:a']).toBeUndefined()
    expect(graph.relations).toHaveLength(0)
  })

  it('should skip missing and malformed indexed entity files', () => {
    const store = createStore()
    store.addEntity('person:missing', { type: 'person', name: 'Missing User' })
    store.addEntity('person:broken', { type: 'person', name: 'Broken User' })

    const dataDir = store.getDataDir()
    const missingPath = path.join(dataDir, 'entities', 'person', 'missing.yaml')
    const brokenPath = path.join(dataDir, 'entities', 'person', 'broken.yaml')

    fs.unlinkSync(missingPath)
    fs.writeFileSync(brokenPath, 'name: [broken', 'utf8')

    const reloaded = new OntologyStore({ dataDir })
    const graph = reloaded.getGraph()

    expect(graph.entities['person:missing']).toBeUndefined()
    expect(graph.entities['person:broken']).toBeUndefined()
  })

  // ── Relation CRUD ───────────────────────────────────────────────────────────

  it('should add and query relations', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('project:b', { type: 'project', name: 'Project B' })
    store.addRelation('person:a', 'owns', 'project:b')

    const graph = store.getGraph()
    expect(graph.relations).toEqual([
      { from: 'person:a', rel: 'owns', to: 'project:b' }
    ])
  })

  it('should throw on relation with missing entity', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    expect(() => {
      store.addRelation('person:a', 'owns', 'project:missing')
    }).toThrow('not found')
  })

  it('should reject unknown relation type', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('project:b', { type: 'project', name: 'Project B' })
    expect(() => {
      store.addRelation('person:a', 'friend_of', 'project:b')
    }).toThrow('Unknown relation type')
  })

  it('should reject invalid type pair for relation', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('person:b', { type: 'person', name: 'Bob' })
    // owns: person → project/document/device, not person
    expect(() => {
      store.addRelation('person:a', 'owns', 'person:b')
    }).toThrow('cannot be the target')
  })

  it('should reject self-loop relation', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    expect(() => {
      store.addRelation('person:a', 'owns', 'person:a')
    }).toThrow('self-referencing')
  })

  // ── Queries ──────────────────────────────────────────────────────────────────

  it('should query related entities (outgoing)', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('project:b', { type: 'project', name: 'Project B' })
    store.addEntity('project:c', { type: 'project', name: 'Project C' })
    store.addRelation('person:a', 'owns', 'project:b')
    store.addRelation('person:a', 'owns', 'project:c')

    const out = store.related('person:a')
    expect(out).toHaveLength(2)

    const byRel = store.related('person:a', 'owns')
    expect(byRel).toHaveLength(2)

    const filtered = store.related('person:a', 'contributes')
    expect(filtered).toHaveLength(0)
  })

  it('should query related entities (incoming)', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('project:b', { type: 'project', name: 'Project B' })
    store.addRelation('person:a', 'owns', 'project:b')

    const inFrom = store.related('project:b')
    expect(inFrom).toHaveLength(1)
    expect(inFrom[0].direction).toBe('in')
    expect(inFrom[0].rel).toBe('owns')
  })

  it('should search entities by name or id', () => {
    const store = createStore()
    store.addEntity('person:imba97', { type: 'person', name: 'imba久期' })
    store.addEntity('project:website', { type: 'project', name: '网站重构' })

    const byName = store.search('久期')
    expect(byName).toHaveLength(1)
    expect(byName[0].id).toBe('person:imba97')

    const byId = store.search('imba97')
    expect(byId).toHaveLength(1)

    const noMatch = store.search('nonexistent')
    expect(noMatch).toHaveLength(0)
  })

  it('should search with type filter', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('project:b', { type: 'project', name: 'Alice Project' })

    const both = store.search('alice')
    expect(both).toHaveLength(2)

    const personsOnly = store.search('alice', 'person')
    expect(personsOnly).toHaveLength(1)
    expect(personsOnly[0].id).toBe('person:a')
  })

  it('should list entities', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('project:b', { type: 'project', name: 'Project B' })

    const all = store.listEntities()
    expect(all).toHaveLength(2)

    const persons = store.listEntities('person')
    expect(persons).toHaveLength(1)
  })

  it('should list types', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('project:b', { type: 'project', name: 'Project B' })
    store.addEntity('task:c', { type: 'task', name: 'Task C' })

    const types = store.listTypes()
    expect(types).toEqual(['person', 'project', 'task'])
  })

  // ── Advanced Queries ─────────────────────────────────────────────────────────

  it('should aggregate by type', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('project:b', { type: 'project', name: 'Project B' })
    store.addEntity('project:c', { type: 'project', name: 'Project C' })

    const result = store.aggregate(undefined, 'type')
    expect(result).toContainEqual({ key: 'person', count: 1 })
    expect(result).toContainEqual({ key: 'project', count: 2 })
  })

  it('should aggregate by status', () => {
    const store = createStore()
    store.addEntity('task:a', { type: 'task', name: 'Task A', status: 'open' })
    store.addEntity('task:b', { type: 'task', name: 'Task B', status: 'open' })
    store.addEntity('task:c', { type: 'task', name: 'Task C', status: 'done' })

    const result = store.aggregate('task', 'status')
    expect(result).toContainEqual({ key: 'open', count: 2 })
    expect(result).toContainEqual({ key: 'done', count: 1 })
  })

  it('should find path between two entities', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('project:b', { type: 'project', name: 'Project B' })
    store.addEntity('task:c', { type: 'task', name: 'Task C' })
    store.addRelation('person:a', 'owns', 'project:b')
    store.addRelation('project:b', 'has_task', 'task:c')

    const path = store.findPath('person:a', 'task:c')
    expect(path).not.toBeNull()
    expect(path!.path).toEqual(['person:a', 'project:b', 'task:c'])
    expect(path!.relations).toHaveLength(2)
  })

  it('should return null for unreachable entities', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('person:b', { type: 'person', name: 'Bob' })
    // No relation between them

    const path = store.findPath('person:a', 'person:b')
    expect(path).toBeNull()
  })

  it('should throw on path with missing entity', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    expect(() => {
      store.findPath('person:a', 'person:missing')
    }).toThrow('not found')
  })

  it('should query with custom predicate', () => {
    const store = createStore()
    store.addEntity('task:a', { type: 'task', name: 'Task A', status: 'open', priority: 'high' })
    store.addEntity('task:b', { type: 'task', name: 'Task B', status: 'open', priority: 'low' })
    store.addEntity('task:c', { type: 'task', name: 'Task C', status: 'done', priority: 'high' })

    const openHigh = store.query(e => e.status === 'open' && e.priority === 'high')
    expect(openHigh).toHaveLength(1)
    expect(openHigh[0].id).toBe('task:a')

    const all = store.query(e => e.type === 'task')
    expect(all).toHaveLength(3)
  })
})
