import type { SimulationNodeDatum } from 'd3-force'

export interface ViewerNode {
  id: string
  type: string
  name: string
  properties: Record<string, unknown>
  incomingCount: number
  outgoingCount: number
  workflow?: ViewerWorkflow
}

export interface ViewerGoal {
  id: string
  text: string
  status: string
  scope?: string
  stage?: string | null
}

export interface ViewerWorkflow {
  status?: string
  stage?: string | null
  completedAt?: string | null
  milestone?: boolean
  goals: ViewerGoal[]
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
