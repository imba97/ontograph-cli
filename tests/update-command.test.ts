import { describe, expect, it } from 'vitest'
import { entityTypeAdd } from '../src/commands/entity-type'
import { entityUpdate } from '../src/commands/update'
import { createStore, seedGraph } from './store/helpers'

describe('entity update command helper', () => {
  it('should update the specified entity id only', () => {
    const store = createStore()
    seedGraph(store, [
      ['person_1111aaaa', { type: 'person', name: 'Alice' }],
      ['person_2222bbbb', { type: 'person', name: 'Bob' }]
    ])

    entityUpdate(store, ['timezone=+9'], 'Alice Updated', 'person_1111aaaa')

    const graph = store.getGraph()
    expect(graph.entities.person_1111aaaa).toMatchObject({
      type: 'person',
      name: 'Alice Updated',
      timezone: '+9'
    })
    expect(graph.entities.person_2222bbbb).toEqual({
      type: 'person',
      name: 'Bob'
    })
  })

  it('should parse props with tags array', () => {
    const store = createStore()
    store.addEntity('person_3333cccc', { type: 'person', name: 'Tag User' })

    entityUpdate(store, ['tags=alpha,beta'], undefined, 'person_3333cccc')

    expect(store.getGraph().entities.person_3333cccc).toMatchObject({
      tags: ['alpha', 'beta']
    })
  })

  it('should parse schema defined custom array field', () => {
    const store = createStore()
    entityTypeAdd(store, 'book', 'Book', 'Book entity', [
      { key: 'name', type: 'string', required: true },
      { key: 'authors', type: 'string[]', required: false }
    ])
    store.addEntity('book_4444dddd', { type: 'book', name: 'Book One' })

    entityUpdate(store, ['authors=a,b'], undefined, 'book_4444dddd')

    expect(store.getGraph().entities.book_4444dddd).toMatchObject({
      authors: ['a', 'b']
    })
  })

  it('should keep non array field as string even with comma', () => {
    const store = createStore()
    store.addEntity('person_5555eeee', { type: 'person', name: 'Note User' })

    entityUpdate(store, ['notes=a,b'], undefined, 'person_5555eeee')

    expect(store.getGraph().entities.person_5555eeee).toMatchObject({
      notes: 'a,b'
    })
  })

  it('should throw when no update fields provided', () => {
    const store = createStore()
    store.addEntity('person_6666ffff', { type: 'person', name: 'No Change' })

    expect(() => {
      entityUpdate(store, [], undefined, 'person_6666ffff')
    }).toThrow('Nothing to update')
  })
})
