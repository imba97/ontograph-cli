import { describe, expect, it } from 'vitest'
import { entityTypeAdd } from '../src/commands/entity-type'
import { entityUpdate } from '../src/commands/update'
import { createStore, seedGraph } from './store/helpers'

describe('entity update command helper', () => {
  it('should update the specified entity id only', () => {
    const store = createStore()
    seedGraph(store, [
      ['person:a', { type: 'person', name: 'Alice' }],
      ['person:b', { type: 'person', name: 'Bob' }]
    ])

    entityUpdate(store, ['timezone=+9'], 'Alice Updated', 'person:a')

    const graph = store.getGraph()
    expect(graph.entities['person:a']).toMatchObject({
      type: 'person',
      name: 'Alice Updated',
      timezone: '+9'
    })
    expect(graph.entities['person:b']).toEqual({
      type: 'person',
      name: 'Bob'
    })
  })

  it('should parse props with tags array', () => {
    const store = createStore()
    store.addEntity('person:tags', { type: 'person', name: 'Tag User' })

    entityUpdate(store, ['tags=alpha,beta'], undefined, 'person:tags')

    expect(store.getGraph().entities['person:tags']).toMatchObject({
      tags: ['alpha', 'beta']
    })
  })

  it('should parse schema defined custom array field', () => {
    const store = createStore()
    entityTypeAdd(store, 'book', 'Book', 'Book entity', [
      { key: 'name', type: 'string', required: true },
      { key: 'authors', type: 'string[]', required: false }
    ])
    store.addEntity('book:1', { type: 'book', name: 'Book One' })

    entityUpdate(store, ['authors=a,b'], undefined, 'book:1')

    expect(store.getGraph().entities['book:1']).toMatchObject({
      authors: ['a', 'b']
    })
  })

  it('should keep non array field as string even with comma', () => {
    const store = createStore()
    store.addEntity('person:notes', { type: 'person', name: 'Note User' })

    entityUpdate(store, ['notes=a,b'], undefined, 'person:notes')

    expect(store.getGraph().entities['person:notes']).toMatchObject({
      notes: 'a,b'
    })
  })

  it('should throw when no update fields provided', () => {
    const store = createStore()
    store.addEntity('person:none', { type: 'person', name: 'No Change' })

    expect(() => {
      entityUpdate(store, [], undefined, 'person:none')
    }).toThrow('Nothing to update')
  })
})
