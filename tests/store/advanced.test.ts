import { describe, expect, it } from 'vitest'
import { createStore, seedGraph } from './helpers'

describe('store advanced query', () => {
  it('should aggregate by type', () => {
    const store = createStore()
    seedGraph(store, [
      ['person_1111aaaa', { type: 'person', name: 'Alice' }],
      ['project_2222bbbb', { type: 'project', name: 'Project B' }],
      ['project_3333cccc', { type: 'project', name: 'Project C' }]
    ])

    const result = store.aggregate(undefined, 'type')
    expect(result).toContainEqual({ key: 'person', count: 1 })
    expect(result).toContainEqual({ key: 'project', count: 2 })
  })

  it('should aggregate by status', () => {
    const store = createStore()
    seedGraph(store, [
      ['task_4444dddd', { type: 'task', name: 'Task A', status: 'open' }],
      ['task_5555eeee', { type: 'task', name: 'Task B', status: 'open' }],
      ['task_6666ffff', { type: 'task', name: 'Task C', status: 'done' }]
    ])

    const result = store.aggregate('task', 'status')
    expect(result).toContainEqual({ key: 'open', count: 2 })
    expect(result).toContainEqual({ key: 'done', count: 1 })
  })

  it('should find path between two entities', () => {
    const store = createStore()
    seedGraph(
      store,
      [
        ['person_7777aaaa', { type: 'person', name: 'Alice' }],
        ['project_8888bbbb', { type: 'project', name: 'Project B' }],
        ['task_9999cccc', { type: 'task', name: 'Task C' }]
      ],
      [
        ['person_7777aaaa', 'owns', 'project_8888bbbb'],
        ['project_8888bbbb', 'has_task', 'task_9999cccc']
      ]
    )

    const path = store.findPath('person_7777aaaa', 'task_9999cccc')
    expect(path).not.toBeNull()
    expect(path!.path).toEqual(['person_7777aaaa', 'project_8888bbbb', 'task_9999cccc'])
    expect(path!.relations).toHaveLength(2)
  })

  it('should return null for unreachable entities', () => {
    const store = createStore()
    seedGraph(store, [
      ['person_aaaabbbb', { type: 'person', name: 'Alice' }],
      ['person_bbbbcccc', { type: 'person', name: 'Bob' }]
    ])

    const path = store.findPath('person_aaaabbbb', 'person_bbbbcccc')
    expect(path).toBeNull()
  })

  it('should throw on path with missing entity', () => {
    const store = createStore()
    seedGraph(store, [['person_ccccdddd', { type: 'person', name: 'Alice' }]])
    expect(() => {
      store.findPath('person_ccccdddd', 'person_ddddeeee')
    }).toThrow('not found')
  })

  it('should query with custom predicate', () => {
    const store = createStore()
    seedGraph(store, [
      ['task_eeeef111', { type: 'task', name: 'Task A', status: 'open', priority: 'high' }],
      ['task_1111aaaa', { type: 'task', name: 'Task B', status: 'open', priority: 'low' }],
      ['task_2222bbbb', { type: 'task', name: 'Task C', status: 'done', priority: 'high' }]
    ])

    const openHigh = store.query(e => e.status === 'open' && e.priority === 'high')
    expect(openHigh).toHaveLength(1)
    expect(openHigh[0].id).toBe('task_eeeef111')

    const all = store.query(e => e.type === 'task')
    expect(all).toHaveLength(3)
  })
})
