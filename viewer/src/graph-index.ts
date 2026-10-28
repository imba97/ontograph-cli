import type { ViewerEdge, ViewerNode } from './types'

export interface ProgressSummary {
  achieved: number
  completed: number
  total: number
  percent: number
  cancelled: number
}

export interface GraphIndex<TNode extends ViewerNode = ViewerNode> {
  nodeById: Map<string, TNode>
  incomingByNodeId: Map<string, ViewerEdge[]>
  outgoingByNodeId: Map<string, ViewerEdge[]>
  childrenByParentId: Map<string, TNode[]>
  goalProgressByNodeId: Map<string, ProgressSummary>
  childProgressByNodeId: Map<string, ProgressSummary>
}

const EMPTY_PROGRESS: ProgressSummary = { achieved: 0, completed: 0, total: 0, percent: 0, cancelled: 0 }

export function isCompletedNode(node: ViewerNode): boolean {
  return ['done', 'completed', 'closed'].includes(node.workflow?.status?.toLocaleLowerCase() ?? '')
}

export function emptyProgress(): ProgressSummary {
  return EMPTY_PROGRESS
}

export function buildGraphIndex<TNode extends ViewerNode>(nodes: TNode[], edges: ViewerEdge[]): GraphIndex<TNode> {
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const incomingByNodeId = new Map<string, ViewerEdge[]>()
  const outgoingByNodeId = new Map<string, ViewerEdge[]>()
  const childIdsByParentId = new Map<string, string[]>()
  const goalProgressByNodeId = new Map<string, ProgressSummary>()

  for (const edge of edges) {
    const incoming = incomingByNodeId.get(edge.target) ?? []
    incoming.push(edge)
    incomingByNodeId.set(edge.target, incoming)

    const outgoing = outgoingByNodeId.get(edge.source) ?? []
    outgoing.push(edge)
    outgoingByNodeId.set(edge.source, outgoing)

    if (edge.relation === 'child_of') {
      const childIds = childIdsByParentId.get(edge.target) ?? []
      childIds.push(edge.source)
      childIdsByParentId.set(edge.target, childIds)
    }
  }

  for (const node of nodes) {
    const goals = node.workflow?.goals ?? []
    const achieved = goals.filter(goal => goal.status === 'achieved').length
    const cancelled = goals.filter(goal => goal.status === 'cancelled').length
    const total = goals.length - cancelled
    goalProgressByNodeId.set(node.id, {
      achieved,
      completed: achieved,
      total,
      percent: total ? achieved / total * 100 : 0,
      cancelled
    })
  }

  const childrenByParentId = new Map<string, TNode[]>()
  const childProgressByNodeId = new Map<string, ProgressSummary>()
  for (const [parentId, childIds] of childIdsByParentId) {
    const children = childIds.flatMap(id => nodeById.get(id) ?? [])
    const completed = children.filter(isCompletedNode).length
    childrenByParentId.set(parentId, children)
    childProgressByNodeId.set(parentId, {
      achieved: completed,
      completed,
      total: children.length,
      percent: children.length ? completed / children.length * 100 : 0,
      cancelled: 0
    })
  }

  return {
    nodeById,
    incomingByNodeId,
    outgoingByNodeId,
    childrenByParentId,
    goalProgressByNodeId,
    childProgressByNodeId
  }
}
