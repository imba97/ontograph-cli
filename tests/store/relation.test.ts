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
        ['person_1111aaaa', { type: 'person', name: 'Alice' }],
        ['project_2222bbbb', { type: 'project', name: 'Project B' }]
      ],
      [['person_1111aaaa', 'owns', 'project_2222bbbb']]
    )

    const graph = store.getGraph()
    expect(graph.relations).toEqual([
      { from: 'person_1111aaaa', rel: 'owns', to: 'project_2222bbbb' }
    ])
  })

  const invalidCases: InvalidRelationCase[] = [
    {
      name: 'relation with missing entity',
      entities: [
        ['person_3333cccc', { type: 'person', name: 'Alice' }]
      ],
      relation: ['person_3333cccc', 'owns', 'project_4444dddd'],
      message: 'not found'
    },
    {
      name: 'unknown relation type',
      entities: [
        ['person_5555eeee', { type: 'person', name: 'Alice' }],
        ['project_6666ffff', { type: 'project', name: 'Project B' }]
      ],
      relation: ['person_5555eeee', 'friend_of', 'project_6666ffff'],
      message: 'Unknown relation type'
    },
    {
      name: 'invalid type pair for relation',
      entities: [
        ['person_7777aaaa', { type: 'person', name: 'Alice' }],
        ['person_8888bbbb', { type: 'person', name: 'Bob' }]
      ],
      relation: ['person_7777aaaa', 'owns', 'person_8888bbbb'],
      message: 'cannot be the target'
    },
    {
      name: 'self-loop relation',
      entities: [
        ['person_9999cccc', { type: 'person', name: 'Alice' }]
      ],
      relation: ['person_9999cccc', 'owns', 'person_9999cccc'],
      message: 'self-referencing'
    },
    {
      name: 'legacy entity id format',
      entities: [
        ['person_aaaabbbb', { type: 'person', name: 'Alice' }],
        ['project_ccccdddd', { type: 'project', name: 'Project B' }]
      ],
      relation: ['person:aaaabbbb', 'owns', 'project_ccccdddd'],
      message: 'Invalid entity id'
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
