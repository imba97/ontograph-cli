import { describe, expect, it } from 'vitest'
import { createStore, seedGraph } from './helpers'

describe('store query', () => {
  it('should query related entities (outgoing)', () => {
    const store = createStore()
    seedGraph(
      store,
      [
        ['person:a', { type: 'person', name: 'Alice' }],
        ['project:b', { type: 'project', name: 'Project B' }],
        ['project:c', { type: 'project', name: 'Project C' }]
      ],
      [
        ['person:a', 'owns', 'project:b'],
        ['person:a', 'owns', 'project:c']
      ]
    )

    const out = store.related('person:a')
    expect(out).toHaveLength(2)

    const byRel = store.related('person:a', 'owns')
    expect(byRel).toHaveLength(2)

    const filtered = store.related('person:a', 'contributes')
    expect(filtered).toHaveLength(0)
  })

  it('should query related entities (incoming)', () => {
    const store = createStore()
    seedGraph(
      store,
      [
        ['person:a', { type: 'person', name: 'Alice' }],
        ['project:b', { type: 'project', name: 'Project B' }]
      ],
      [['person:a', 'owns', 'project:b']]
    )

    const inFrom = store.related('project:b')
    expect(inFrom).toHaveLength(1)
    expect(inFrom[0].direction).toBe('in')
    expect(inFrom[0].rel).toBe('owns')
  })

  it('should search entities by name or id', () => {
    const store = createStore()
    seedGraph(store, [
      ['person:imba97', { type: 'person', name: 'imba久期' }],
      ['project:website', { type: 'project', name: '网站重构' }]
    ])

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
    seedGraph(store, [
      ['person:a', { type: 'person', name: 'Alice' }],
      ['project:b', { type: 'project', name: 'Alice Project' }]
    ])

    const both = store.search('alice')
    expect(both).toHaveLength(2)

    const personsOnly = store.search('alice', 'person')
    expect(personsOnly).toHaveLength(1)
    expect(personsOnly[0].id).toBe('person:a')
  })

  it('should list entities', () => {
    const store = createStore()
    seedGraph(store, [
      ['person:a', { type: 'person', name: 'Alice' }],
      ['project:b', { type: 'project', name: 'Project B' }]
    ])

    const all = store.listEntities()
    expect(all).toHaveLength(2)

    const persons = store.listEntities('person')
    expect(persons).toHaveLength(1)
  })

  it('should list types', () => {
    const store = createStore()
    seedGraph(store, [
      ['person:a', { type: 'person', name: 'Alice' }],
      ['project:b', { type: 'project', name: 'Project B' }],
      ['task:c', { type: 'task', name: 'Task C' }]
    ])

    const types = store.listTypes()
    expect(types).toEqual(['person', 'project', 'task'])
  })
})
