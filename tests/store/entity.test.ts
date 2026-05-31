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
