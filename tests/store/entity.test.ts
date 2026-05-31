import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OntologyStore } from '../../src/store'
import { createStore, seedGraph } from './helpers'

describe('store entity', () => {
  it('should add and retrieve entities', () => {
    const store = createStore()
    seedGraph(store, [['person:test', { type: 'person', name: 'Test User' }]])

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
      store.addEntity('project:bad', { type: 'project', name: '' })
    }).toThrow('Validation failed')
  })

  it('should update entity fields with merge patch', () => {
    const store = createStore()
    store.addEntity('person:update', {
      type: 'person',
      name: 'Alice',
      timezone: '+8',
      tags: ['a']
    })

    store.updateEntity('person:update', {
      name: 'Alice Updated',
      tags: ['a', 'b']
    })

    const graph = store.getGraph()
    expect(graph.entities['person:update']).toEqual({
      type: 'person',
      name: 'Alice Updated',
      timezone: '+8',
      tags: ['a', 'b']
    })
  })

  it('should persist updated entity to yaml file', () => {
    const store = createStore()
    store.addEntity('person:persist', { type: 'person', name: 'Before' })
    store.updateEntity('person:persist', {
      name: 'After',
      city: 'Shenzhen'
    })

    const reloaded = new OntologyStore({ dataDir: store.getDataDir() })
    expect(reloaded.getGraph().entities['person:persist']).toEqual({
      type: 'person',
      name: 'After',
      city: 'Shenzhen'
    })
  })

  it('should throw when updating missing entity', () => {
    const store = createStore()
    expect(() => {
      store.updateEntity('person:missing', { name: 'Nope' })
    }).toThrow('not found')
  })

  it('should validate updated entity against schema', () => {
    const store = createStore()
    store.addEntity('project:alpha', {
      type: 'project',
      name: 'Alpha',
      status: 'active'
    })

    expect(() => {
      store.updateEntity('project:alpha', { status: 'invalid-status' })
    }).toThrow('Validation failed')
  })

  it('should reject changing entity type during update', () => {
    const store = createStore()
    store.addEntity('person:type-lock', { type: 'person', name: 'Type Locked' })

    expect(() => {
      store.updateEntity('person:type-lock', { type: 'project' })
    }).toThrow('type cannot be changed')
  })

  it('should keep relations after entity update', () => {
    const store = createStore()
    seedGraph(
      store,
      [
        ['person:owner', { type: 'person', name: 'Owner' }],
        ['project:work', { type: 'project', name: 'Work' }]
      ],
      [['person:owner', 'owns', 'project:work']]
    )

    store.updateEntity('person:owner', { name: 'Owner Updated' })

    const graph = store.getGraph()
    expect(graph.relations).toEqual([
      { from: 'person:owner', rel: 'owns', to: 'project:work' }
    ])
  })

  it('should remove entity and cascading relations', () => {
    const store = createStore()
    seedGraph(
      store,
      [
        ['person:a', { type: 'person', name: 'Alice' }],
        ['project:b', { type: 'project', name: 'Project B' }]
      ],
      [['person:a', 'owns', 'project:b']]
    )

    store.removeEntity('person:a')

    const graph = store.getGraph()
    expect(graph.entities['person:a']).toBeUndefined()
    expect(graph.relations).toHaveLength(0)
  })

  it('should skip missing and malformed indexed entity files', () => {
    const store = createStore()
    seedGraph(store, [
      ['person:missing', { type: 'person', name: 'Missing User' }],
      ['person:broken', { type: 'person', name: 'Broken User' }]
    ])

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
})
