import { describe, expect, it } from 'vitest'
import { createStore } from './helpers'

describe('store relation', () => {
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
})
