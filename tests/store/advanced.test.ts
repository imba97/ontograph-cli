import { describe, expect, it } from 'vitest'
import { createStore } from './helpers'

describe('store advanced query', () => {
  it('should aggregate by type', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('project:b', { type: 'project', name: 'Project B' })
    store.addEntity('project:c', { type: 'project', name: 'Project C' })

    const result = store.aggregate(undefined, 'type')
    expect(result).toContainEqual({ key: 'person', count: 1 })
    expect(result).toContainEqual({ key: 'project', count: 2 })
  })

  it('should aggregate by status', () => {
    const store = createStore()
    store.addEntity('task:a', { type: 'task', name: 'Task A', status: 'open' })
    store.addEntity('task:b', { type: 'task', name: 'Task B', status: 'open' })
    store.addEntity('task:c', { type: 'task', name: 'Task C', status: 'done' })

    const result = store.aggregate('task', 'status')
    expect(result).toContainEqual({ key: 'open', count: 2 })
    expect(result).toContainEqual({ key: 'done', count: 1 })
  })

  it('should find path between two entities', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('project:b', { type: 'project', name: 'Project B' })
    store.addEntity('task:c', { type: 'task', name: 'Task C' })
    store.addRelation('person:a', 'owns', 'project:b')
    store.addRelation('project:b', 'has_task', 'task:c')

    const path = store.findPath('person:a', 'task:c')
    expect(path).not.toBeNull()
    expect(path!.path).toEqual(['person:a', 'project:b', 'task:c'])
    expect(path!.relations).toHaveLength(2)
  })

  it('should return null for unreachable entities', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    store.addEntity('person:b', { type: 'person', name: 'Bob' })

    const path = store.findPath('person:a', 'person:b')
    expect(path).toBeNull()
  })

  it('should throw on path with missing entity', () => {
    const store = createStore()
    store.addEntity('person:a', { type: 'person', name: 'Alice' })
    expect(() => {
      store.findPath('person:a', 'person:missing')
    }).toThrow('not found')
  })

  it('should query with custom predicate', () => {
    const store = createStore()
    store.addEntity('task:a', { type: 'task', name: 'Task A', status: 'open', priority: 'high' })
    store.addEntity('task:b', { type: 'task', name: 'Task B', status: 'open', priority: 'low' })
    store.addEntity('task:c', { type: 'task', name: 'Task C', status: 'done', priority: 'high' })

    const openHigh = store.query(e => e.status === 'open' && e.priority === 'high')
    expect(openHigh).toHaveLength(1)
    expect(openHigh[0].id).toBe('task:a')

    const all = store.query(e => e.type === 'task')
    expect(all).toHaveLength(3)
  })
})
