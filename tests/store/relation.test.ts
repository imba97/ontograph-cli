import { describe, expect, it } from 'vitest'
import { createStore, seedGraph } from './helpers'

interface InvalidRelationCase {
  name: string
  entities: Array<[string, { type: string, name: string }]>
  relation: [string, string, string]
  message: string
}

describe('store relation', () => {
  it('should add and query relations', () => {
    const store = createStore()
    seedGraph(
      store,
      [
        ['person:a', { type: 'person', name: 'Alice' }],
        ['project:b', { type: 'project', name: 'Project B' }]
      ],
      [['person:a', 'owns', 'project:b']]
    )

    const graph = store.getGraph()
    expect(graph.relations).toEqual([
      { from: 'person:a', rel: 'owns', to: 'project:b' }
    ])
  })

  const invalidCases: InvalidRelationCase[] = [
    {
      name: 'relation with missing entity',
      entities: [
        ['person:a', { type: 'person', name: 'Alice' }]
      ],
      relation: ['person:a', 'owns', 'project:missing'],
      message: 'not found'
    },
    {
      name: 'unknown relation type',
      entities: [
        ['person:a', { type: 'person', name: 'Alice' }],
        ['project:b', { type: 'project', name: 'Project B' }]
      ],
      relation: ['person:a', 'friend_of', 'project:b'],
      message: 'Unknown relation type'
    },
    {
      name: 'invalid type pair for relation',
      entities: [
        ['person:a', { type: 'person', name: 'Alice' }],
        ['person:b', { type: 'person', name: 'Bob' }]
      ],
      relation: ['person:a', 'owns', 'person:b'],
      message: 'cannot be the target'
    },
    {
      name: 'self-loop relation',
      entities: [
        ['person:a', { type: 'person', name: 'Alice' }]
      ],
      relation: ['person:a', 'owns', 'person:a'],
      message: 'self-referencing'
    }
  ]

  it.each(invalidCases)('should reject $name', ({ entities, relation, message }) => {
    const store = createStore()
    seedGraph(store, entities)
    expect(() => {
      const [from, rel, to] = relation
      store.addRelation(from, rel, to)
    }).toThrow(message)
  })
})
