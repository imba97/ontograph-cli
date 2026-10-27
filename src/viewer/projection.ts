import type { Entity, Graph } from '../types'

export interface ViewerNode {
  id: string
  type: string
  name: string
  properties: Record<string, unknown>
  incomingCount: number
  outgoingCount: number
}

export interface ViewerEdge {
  id: string
  source: string
  target: string
  relation: string
  label: string
}

export interface ViewerGraph {
  generatedAt: string
  nodes: ViewerNode[]
  edges: ViewerEdge[]
  entityTypes: string[]
  relationTypes: string[]
}

function safeProperties(entity: Entity): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(entity)
      .filter(([key]) => key !== 'type' && key !== 'name')
      .map(([key, value]) => [key, JSON.parse(JSON.stringify(value)) as unknown])
  )
}

export function projectViewerGraph(graph: Graph, generatedAt = new Date().toISOString()): ViewerGraph {
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()

  for (const relation of graph.relations) {
    outgoing.set(relation.from, (outgoing.get(relation.from) ?? 0) + 1)
    incoming.set(relation.to, (incoming.get(relation.to) ?? 0) + 1)
  }

  const nodes = Object.entries(graph.entities)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, entity]) => ({
      id,
      type: entity.type,
      name: String(entity.name),
      properties: safeProperties(entity),
      incomingCount: incoming.get(id) ?? 0,
      outgoingCount: outgoing.get(id) ?? 0
    }))

  const duplicateCounts = new Map<string, number>()
  const edges = graph.relations
    .map((relation) => {
      const base = `${relation.from}\u0000${relation.rel}\u0000${relation.to}`
      const duplicate = duplicateCounts.get(base) ?? 0
      duplicateCounts.set(base, duplicate + 1)
      return {
        id: `${relation.from}:${relation.rel}:${relation.to}:${duplicate}`,
        source: relation.from,
        target: relation.to,
        relation: relation.rel,
        label: relation.rel
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id))

  return {
    generatedAt,
    nodes,
    edges,
    entityTypes: [...new Set(nodes.map(node => node.type))].sort(),
    relationTypes: [...new Set(edges.map(edge => edge.relation))].sort()
  }
}
