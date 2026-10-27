import type { SimulationNodeDatum } from 'd3-force'

export interface ViewerNode {
  id: string
  type: string
  name: string
  properties: Record<string, unknown>
  incomingCount: number
  outgoingCount: number
}

export interface LayoutNode extends ViewerNode, SimulationNodeDatum {
  x: number
  y: number
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
