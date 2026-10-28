import type { ViewerEdge, ViewerNode } from '../viewer/src/types'
import { describe, expect, it } from 'vitest'
import { buildGraphIndex } from '../viewer/src/graph-index'

function task(id: string, status: string, goals: NonNullable<ViewerNode['workflow']>['goals'] = []): ViewerNode {
  return {
    id,
    type: 'todo',
    name: id,
    properties: {},
    incomingCount: 0,
    outgoingCount: 0,
    workflow: {
      key: 'task',
      status,
      completed: status === 'done',
      goals,
      history: [],
      hierarchy: { relation: 'child_of', direction: 'child-to-parent' }
    }
  }
}

describe('viewer graph index', () => {
  it('indexes adjacency and explicit progress once', () => {
    const parent = task('parent', 'in-progress', [
      { id: 'goal-1', text: 'Done', status: 'achieved' },
      { id: 'goal-2', text: 'Pending', status: 'pending' },
      { id: 'goal-3', text: 'Cancelled', status: 'cancelled' }
    ])
    const doneChild = task('done-child', 'done')
    const openChild = task('open-child', 'todo')
    const edges: ViewerEdge[] = [
      { id: 'edge-1', source: doneChild.id, target: parent.id, relation: 'child_of', label: 'child_of' },
      { id: 'edge-2', source: openChild.id, target: parent.id, relation: 'child_of', label: 'child_of' }
    ]

    const index = buildGraphIndex([parent, doneChild, openChild], edges)

    expect(index.incomingByNodeId.get(parent.id)).toEqual(edges)
    expect(index.outgoingByNodeId.get(doneChild.id)).toEqual([edges[0]])
    expect(index.childrenByParentId.get(parent.id)).toEqual([doneChild, openChild])
    expect(index.goalProgressByNodeId.get(parent.id)).toMatchObject({ achieved: 1, total: 2, cancelled: 1, percent: 50 })
    expect(index.childProgressByNodeId.get(parent.id)).toMatchObject({ completed: 1, total: 2, percent: 50 })
  })
})
