import { describe, expect, it } from 'vitest'
import { entityAdd } from '../src/commands/add'
import { entityTypeAdd } from '../src/commands/entity-type'
import { createStore } from './store/helpers'

describe('entity add command helper', () => {
  it('should parse preset array field tags by schema', () => {
    const store = createStore()

    entityAdd(store, 'person', 'preset-tags', 'Preset Tags', ['tags=a,b,c'])

    expect(store.getGraph().entities['person:preset-tags']).toMatchObject({
      tags: ['a', 'b', 'c']
    })
  })

  it('should parse custom type array field by schema', () => {
    const store = createStore()
    entityTypeAdd(store, 'book', 'Book', 'Book entity', [
      { key: 'name', type: 'string', required: true },
      { key: 'authors', type: 'string[]', required: false }
    ])

    entityAdd(store, 'book', 'schema-array', 'Schema Array', ['authors=a,b'])

    expect(store.getGraph().entities['book:schema-array']).toMatchObject({
      authors: ['a', 'b']
    })
  })

  it('should keep non array field as string', () => {
    const store = createStore()

    entityAdd(store, 'person', 'plain-field', 'Plain Field', ['notes=a,b'])

    expect(store.getGraph().entities['person:plain-field']).toMatchObject({
      notes: 'a,b'
    })
  })
})
