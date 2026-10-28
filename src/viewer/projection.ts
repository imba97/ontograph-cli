import type { Entity, Graph } from '../types'
import type { ViewerConfig, ViewerWorkflowConfig } from './config'
import { DEFAULT_VIEWER_CONFIG, matchConfiguredRule } from './config'

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
  key: string
  status?: string
  statusLabel?: string
  statusColor?: string
  completed: boolean
  stage?: string | null
  completedAt?: string | null
  milestone?: boolean
  goals: ViewerGoal[]
  history: ViewerHistory[]
  hierarchy?: ViewerWorkflowConfig['hierarchy']
}

export interface ViewerHistory {
  id: string
  at: string
  kind: string
  text: string
  from?: string | null
  to?: string
  stage?: string | null
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

function projectWorkflow(entity: Entity, config: ViewerConfig): ViewerWorkflow | undefined {
  const workflowEntry = Object.entries(config.workflows).find(([, workflow]) => workflow.entityTypes.includes(entity.type))
  if (!workflowEntry)
    return undefined
  const [key, workflow] = workflowEntry
  const status = entity[workflow.fields.status]
  const stage = workflow.fields.stage ? entity[workflow.fields.stage] : undefined
  const goalsValue = workflow.fields.goals ? entity[workflow.fields.goals] : undefined
  const historyValue = workflow.fields.history ? entity[workflow.fields.history] : undefined
  const milestone = workflow.fields.milestone ? entity[workflow.fields.milestone] : undefined
  const completedAt = workflow.fields.completedAt ? entity[workflow.fields.completedAt] : undefined

  const goals = Array.isArray(goalsValue)
    ? goalsValue.flatMap((goal, index) => {
        if (!goal || typeof goal !== 'object')
          return []
        const value = goal as Record<string, unknown>
        if (typeof value.text !== 'string' || typeof value.status !== 'string')
          return []
        return [{
          id: typeof value.id === 'string' ? value.id : `goal-${index}`,
          text: value.text,
          status: value.status,
          scope: typeof value.scope === 'string' ? value.scope : undefined,
          stage: typeof value.stage === 'string' || value.stage === null ? value.stage : undefined
        }]
      })
    : []

  const history = Array.isArray(historyValue)
    ? historyValue.flatMap((entry, index) => {
        if (!entry || typeof entry !== 'object')
          return []
        const value = entry as Record<string, unknown>
        if (typeof value.at !== 'string' || typeof value.kind !== 'string' || typeof value.text !== 'string')
          return []
        return [{
          id: typeof value.id === 'string' ? value.id : `history-${index}`,
          at: value.at,
          kind: value.kind,
          text: value.text,
          from: typeof value.from === 'string' || value.from === null ? value.from : undefined,
          to: typeof value.to === 'string' ? value.to : undefined,
          stage: typeof value.stage === 'string' || value.stage === null ? value.stage : undefined
        }]
      })
    : []

  return {
    key,
    status: typeof status === 'string' ? status : undefined,
    statusLabel: typeof status === 'string' ? workflow.statuses[status]?.label : undefined,
    statusColor: typeof status === 'string' ? workflow.statuses[status]?.color : undefined,
    completed: typeof status === 'string' ? workflow.statuses[status]?.completed ?? false : false,
    stage: typeof stage === 'string' || stage === null ? stage : undefined,
    completedAt: typeof completedAt === 'string' || completedAt === null ? completedAt : undefined,
    milestone: typeof milestone === 'boolean' ? milestone : undefined,
    goals,
    history,
    hierarchy: workflow.hierarchy
  }
}

export function projectViewerGraph(graph: Graph, generatedAt = new Date().toISOString(), config: ViewerConfig = DEFAULT_VIEWER_CONFIG): ViewerGraph {
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
      outgoingCount: outgoing.get(id) ?? 0,
      workflow: projectWorkflow(entity, config)
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
        label: matchConfiguredRule(config.relations, relation.rel)?.label ?? relation.rel
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
