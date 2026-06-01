import { describe, expect, it } from 'vitest'
import { entityAdd } from '../src/commands/add'
import { entityTypeAdd } from '../src/commands/entity-type'
import { createStore } from './store/helpers'

describe('entity add command helper', () => {
  it('should parse preset array field tags by schema', () => {
    const store = createStore()

    entityAdd(store, 'person', 'Preset Tags', ['tags=a,b,c'])

    const [entityId, entity] = Object.entries(store.getGraph().entities)[0]
    expect(entityId).toMatch(/^person_[a-f0-9]{12}$/)
    expect(entity).toMatchObject({
      tags: ['a', 'b', 'c']
    })
  })

  it('should parse custom type array field by schema', () => {
    const store = createStore()
    entityTypeAdd(store, 'book', 'Book', 'Book entity', [
      { name: 'name', type: 'string', required: true },
      { name: 'authors', type: 'array' }
    ])

    entityAdd(store, 'book', 'Schema Array', ['authors=a,b'])

    const [entityId, entity] = Object.entries(store.getGraph().entities)[0]
    expect(entityId).toMatch(/^book_[a-f0-9]{12}$/)
    expect(entity).toMatchObject({
      authors: ['a', 'b']
    })
  })

  it('should keep non array field as string', () => {
    const store = createStore()

    entityAdd(store, 'person', 'Plain Field', ['notes=a,b'])

    const [, entity] = Object.entries(store.getGraph().entities)[0]
    expect(entity).toMatchObject({
      notes: 'a,b'
    })
  })
})
