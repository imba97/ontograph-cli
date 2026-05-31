import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import yaml from 'yaml'
import {
  entityTypeAdd,
  entityTypeUpdate
} from '../src/commands/entity-type'
import {
  relationTypeAdd,
  relationTypeUpdate
} from '../src/commands/relation-type'
import { createStore } from './store/helpers'

describe('custom type update commands', () => {
  it('should update user entity type definition', () => {
    const store = createStore()
    entityTypeAdd(store, 'book', 'Book', 'Book entity', [
      { key: 'name', type: 'string', required: true }
    ])

    entityTypeUpdate(store, 'book', 'Book Updated', 'Updated desc', [
      { key: 'name', type: 'string', required: true },
      { key: 'isbn', type: 'string', required: false }
    ])

    const schemaPath = path.join(store.getDataDir(), 'user-entities', 'book.yaml')
    const schema = yaml.parse(fs.readFileSync(schemaPath, 'utf8')) as {
      name: string
      description?: string
      fields: Record<string, { type: string }>
    }
    expect(schema.name).toBe('Book Updated')
    expect(schema.description).toBe('Updated desc')
    expect(schema.fields.isbn.type).toBe('string')
  })

  it('should reject updating missing user entity type', () => {
    const store = createStore()
    expect(() => {
      entityTypeUpdate(store, 'missing', 'Name', 'Desc')
    }).toThrow('not found')
  })

  it('should reject updating preset entity type', () => {
    const store = createStore()
    expect(() => {
      entityTypeUpdate(store, 'person', 'Name', 'Desc')
    }).toThrow('preset type')
  })

  it('should validate entity type fields on update', () => {
    const store = createStore()
    entityTypeAdd(store, 'book', 'Book', 'Book entity', [
      { key: 'name', type: 'string', required: true }
    ])
    expect(() => {
      entityTypeUpdate(store, 'book', undefined, undefined, [
        { key: 'badField', type: 'custom', required: false }
      ])
    }).toThrow('Unknown type in field')
  })

  it('should update user relation type definition', () => {
    const store = createStore()
    relationTypeAdd(
      store,
      'works_on',
      'Works on',
      'Initial',
      ['person'],
      ['project']
    )

    relationTypeUpdate(
      store,
      'works_on',
      'Works on updated',
      'Updated',
      ['person', 'organization'],
      ['project', 'task']
    )

    const schemaPath = path.join(store.getDataDir(), 'user-relations', 'works_on.yaml')
    const schema = yaml.parse(fs.readFileSync(schemaPath, 'utf8')) as {
      name: string
      description?: string
      fromTypes: string[]
      toTypes: string[]
    }
    expect(schema.name).toBe('Works on updated')
    expect(schema.description).toBe('Updated')
    expect(schema.fromTypes).toEqual(['person', 'organization'])
    expect(schema.toTypes).toEqual(['project', 'task'])
  })

  it('should reject relation type update for missing or preset names', () => {
    const store = createStore()
    expect(() => {
      relationTypeUpdate(store, 'missing', 'Name', 'Desc')
    }).toThrow('not found')
    expect(() => {
      relationTypeUpdate(store, 'owns', 'Name', 'Desc')
    }).toThrow('preset')
  })

  it('should validate relation type update references', () => {
    const store = createStore()
    relationTypeAdd(store, 'works_on', 'Works on', 'Initial', ['person'], ['project'])
    expect(() => {
      relationTypeUpdate(store, 'works_on', undefined, undefined, ['person'], ['unknown_type'])
    }).toThrow('Unknown entity type')
  })
})
