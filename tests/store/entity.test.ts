import fs from 'node:fs'
import path from 'node:path'
import { consola } from 'consola'
import { describe, expect, it, vi } from 'vitest'
import { OntologyStore } from '../../src/store'
import { createStore, seedGraph } from './helpers'

describe('store entity', () => {
  it('should add and retrieve entities', () => {
    const store = createStore()
    seedGraph(store, [['person_aaaabbbb', { type: 'person', name: 'Test User' }]])

    const graph = store.getGraph()
    expect(graph.entities.person_aaaabbbb).toEqual({ type: 'person', name: 'Test User' })
  })

  it('should persist entity using YAML file layout', () => {
    const store = createStore()
    store.addEntity('person_11112222', { type: 'person', name: 'YAML Layout' })

    const dataDir = store.getDataDir()
    const indexPath = path.join(dataDir, 'index.yaml')
    const entityPath = path.join(dataDir, 'entities', 'person', '11112222.yaml')

    expect(fs.existsSync(indexPath)).toBe(true)
    expect(fs.existsSync(entityPath)).toBe(true)
  })

  it('should throw on duplicate entity', () => {
    const store = createStore()
    store.addEntity('person_33334444', { type: 'person', name: 'Test User' })
    expect(() => {
      store.addEntity('person_33334444', { type: 'person', name: 'Duplicate' })
    }).toThrow('already exists')
  })

  it('should validate entity against schema', () => {
    const store = createStore()
    expect(() => {
      store.addEntity('project_55556666', { type: 'project', name: '' })
    }).toThrow('Validation failed')
  })

  it('should update entity fields with merge patch', () => {
    const store = createStore()
    store.addEntity('person_77778888', {
      type: 'person',
      name: 'Alice',
      timezone: '+8',
      tags: ['a']
    })

    store.updateEntity('person_77778888', {
      name: 'Alice Updated',
      tags: ['a', 'b']
    })

    const graph = store.getGraph()
    expect(graph.entities.person_77778888).toEqual({
      type: 'person',
      name: 'Alice Updated',
      timezone: '+8',
      tags: ['a', 'b']
    })
  })

  it('should persist updated entity to yaml file', () => {
    const store = createStore()
    store.addEntity('person_9999aaaa', { type: 'person', name: 'Before' })
    store.updateEntity('person_9999aaaa', {
      name: 'After',
      city: 'Shenzhen'
    })

    const reloaded = new OntologyStore({ dataDir: store.getDataDir() })
    expect(reloaded.getGraph().entities.person_9999aaaa).toEqual({
      type: 'person',
      name: 'After',
      city: 'Shenzhen'
    })
  })

  it('should throw when updating missing entity', () => {
    const store = createStore()
    expect(() => {
      store.updateEntity('person_bbbbcccc', { name: 'Nope' })
    }).toThrow('not found')
  })

  it('should validate updated entity against schema', () => {
    const store = createStore()
    store.addEntity('project_ccccdddd', {
      type: 'project',
      name: 'Alpha',
      status: 'active'
    })

    expect(() => {
      store.updateEntity('project_ccccdddd', { status: 'invalid-status' })
    }).toThrow('Validation failed')
  })

  it('should reject changing entity type during update', () => {
    const store = createStore()
    store.addEntity('person_ddddeeee', { type: 'person', name: 'Type Locked' })

    expect(() => {
      store.updateEntity('person_ddddeeee', { type: 'project' })
    }).toThrow('type cannot be changed')
  })

  it('should keep relations after entity update', () => {
    const store = createStore()
    seedGraph(
      store,
      [
        ['person_eeeeffff', { type: 'person', name: 'Owner' }],
        ['project_aaaacccc', { type: 'project', name: 'Work' }]
      ],
      [['person_eeeeffff', 'owns', 'project_aaaacccc']]
    )

    store.updateEntity('person_eeeeffff', { name: 'Owner Updated' })

    const graph = store.getGraph()
    expect(graph.relations).toEqual([
      { from: 'person_eeeeffff', rel: 'owns', to: 'project_aaaacccc' }
    ])
  })

  it('should remove entity and cascading relations', () => {
    const store = createStore()
    seedGraph(
      store,
      [
        ['person_1111aaaa', { type: 'person', name: 'Alice' }],
        ['project_2222bbbb', { type: 'project', name: 'Project B' }]
      ],
      [['person_1111aaaa', 'owns', 'project_2222bbbb']]
    )

    store.removeEntity('person_1111aaaa')

    const graph = store.getGraph()
    expect(graph.entities.person_1111aaaa).toBeUndefined()
    expect(graph.relations).toHaveLength(0)
  })

  it('should skip missing and malformed indexed entity files', () => {
    const warnSpy = vi.spyOn(consola, 'warn').mockImplementation(() => {})
    try {
      const store = createStore()
      seedGraph(store, [
        ['person_abcd1234', { type: 'person', name: 'Missing User' }],
        ['person_abcd5678', { type: 'person', name: 'Broken User' }]
      ])

      const dataDir = store.getDataDir()
      const missingPath = path.join(dataDir, 'entities', 'person', 'abcd1234.yaml')
      const brokenPath = path.join(dataDir, 'entities', 'person', 'abcd5678.yaml')

      fs.unlinkSync(missingPath)
      fs.writeFileSync(brokenPath, 'name: [broken', 'utf8')

      const reloaded = new OntologyStore({ dataDir })
      const graph = reloaded.getGraph()

      expect(graph.entities.person_abcd1234).toBeUndefined()
      expect(graph.entities.person_abcd5678).toBeUndefined()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Indexed entity file is missing'))
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Malformed entity YAML'))
    }
    finally {
      warnSpy.mockRestore()
    }
  })
})
