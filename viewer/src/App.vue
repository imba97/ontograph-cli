<script setup lang="ts">
import type { Simulation, SimulationLinkDatum } from 'd3-force'
import type { LayoutNode, ViewerEdge, ViewerGraph, ViewerNode } from './types'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDot,
  Flag,
  Focus,
  Moon,
  Network,
  RefreshCcw,
  RefreshCw,
  Search,
  Square,
  Sun,
  X,
  ZoomIn,
  ZoomOut
} from '@lucide/vue'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { wheelZoomFactor } from './zoom'

interface Point { x: number, y: number }
interface Transform { x: number, y: number, scale: number }
interface LayoutLink extends SimulationLinkDatum<LayoutNode> { id: string }

const TYPE_COLORS = ['#7c6cf2', '#0ea5a4', '#e07a45', '#db5c95', '#3f83d1', '#8a9a44', '#b668db', '#60798c']
const graph = ref<ViewerGraph | null>(null)
const nodes = ref<LayoutNode[]>([])
const loading = ref(true)
const reloadError = ref('')
const query = ref('')
const selectedId = ref('')
const cardMode = ref(localStorage.getItem('ontograph-node-mode') !== 'dot')
const dark = ref(localStorage.getItem('ontograph-theme') === 'dark' || (!localStorage.getItem('ontograph-theme') && matchMedia('(prefers-color-scheme: dark)').matches))
const hiddenTypes = reactive(new Set<string>())
const hiddenRelations = reactive(new Set<string>())
const hiddenStatuses = reactive(new Set<string>())
const hiddenStages = reactive(new Set<string>())
const transform = reactive<Transform>({ x: 0, y: 0, scale: 1 })
const canvas = ref<HTMLElement | null>(null)
const positionsVersion = ref(0)
let simulation: Simulation<LayoutNode, LayoutLink> | null = null
let panStart: Point | null = null
let dragNode: LayoutNode | null = null

const nodeById = computed(() => new Map(nodes.value.map(node => [node.id, node])))
const selected = computed(() => selectedId.value ? nodeById.value.get(selectedId.value) ?? null : null)
const workflowNodes = computed(() => nodes.value.filter(node => node.workflow))
const taskNodes = computed(() => workflowNodes.value.filter(isTaskNode))
const workflowStatuses = computed(() => [...new Set(taskNodes.value.flatMap(node => node.workflow?.status ? [node.workflow.status] : []))].sort())
const workflowStages = computed(() => [...new Set(taskNodes.value.map(node => node.workflow?.stage || 'Unstaged'))].sort())
const completedTaskCount = computed(() => taskNodes.value.filter(node => isCompleted(node)).length)
const visibleNodes = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  return nodes.value.filter((node) => {
    const stage = node.workflow?.stage || 'Unstaged'
    const workflowVisible = !isTaskNode(node)
      || ((!node.workflow?.status || !hiddenStatuses.has(node.workflow.status)) && !hiddenStages.has(stage))
    return !hiddenTypes.has(node.type)
      && workflowVisible
      && (!needle || node.name.toLocaleLowerCase().includes(needle) || node.id.toLocaleLowerCase().includes(needle))
  })
})
const visibleIds = computed(() => new Set(visibleNodes.value.map(node => node.id)))
const visibleEdges = computed(() => graph.value?.edges.filter(edge => !hiddenRelations.has(edge.relation) && visibleIds.value.has(edge.source) && visibleIds.value.has(edge.target)) ?? [])
const selectedEdges = computed(() => selectedId.value ? visibleEdges.value.filter(edge => edge.source === selectedId.value || edge.target === selectedId.value) : [])
const selectedEdgeIds = computed(() => new Set(selectedEdges.value.map(edge => edge.id)))
const neighborIds = computed(() => {
  const ids = new Set<string>()
  for (const edge of selectedEdges.value)
    ids.add(edge.source === selectedId.value ? edge.target : edge.source)
  return ids
})
const incoming = computed(() => graph.value?.edges.filter(edge => edge.target === selectedId.value) ?? [])
const outgoing = computed(() => graph.value?.edges.filter(edge => edge.source === selectedId.value) ?? [])
const selectedProperties = computed(() => {
  if (!selected.value?.workflow)
    return selected.value?.properties ?? {}
  const workflowKeys = new Set(['status', 'stage', 'goals', 'completedAt', 'milestone'])
  return Object.fromEntries(Object.entries(selected.value.properties).filter(([key]) => !workflowKeys.has(key)))
})
const selectedGoals = computed(() => {
  const workflow = selected.value?.workflow
  if (!workflow)
    return []
  return [...workflow.goals].sort((left, right) => {
    const leftCurrent = left.stage === workflow.stage ? 0 : left.stage == null ? 1 : 2
    const rightCurrent = right.stage === workflow.stage ? 0 : right.stage == null ? 1 : 2
    return leftCurrent - rightCurrent
  })
})

const STATUS_LABELS: Record<string, string> = {
  'todo': 'Todo',
  'in-progress': 'In progress',
  'done': 'Closed',
  'reopened': 'Reopened'
}

const STATUS_COLORS: Record<string, string> = {
  'todo': '#8b8f9c',
  'in-progress': '#6750d8',
  'done': '#22a06b',
  'reopened': '#d9822b'
}

function statusLabel(status?: string): string {
  return status ? STATUS_LABELS[status] ?? status : 'Unknown'
}

function statusColor(status?: string): string {
  return status ? STATUS_COLORS[status] ?? '#60798c' : '#8b8f9c'
}

function statusCount(status: string): number {
  return taskNodes.value.filter(node => node.workflow?.status === status).length
}

function stageCount(stage: string): number {
  return taskNodes.value.filter(node => (node.workflow?.stage || 'Unstaged') === stage).length
}

function isTaskNode(node: ViewerNode): boolean {
  return ['task', 'todo'].includes(node.type.toLocaleLowerCase())
}

function isCompleted(node: ViewerNode): boolean {
  return ['done', 'completed', 'closed'].includes(node.workflow?.status?.toLocaleLowerCase() ?? '')
}

function goalProgress(node: ViewerNode): { achieved: number, total: number, percent: number, cancelled: number } {
  const goals = node.workflow?.goals ?? []
  const achieved = goals.filter(goal => goal.status === 'achieved').length
  const cancelled = goals.filter(goal => goal.status === 'cancelled').length
  const total = goals.length - cancelled
  return { achieved, total, percent: total ? achieved / total * 100 : 0, cancelled }
}

function resetFilters(): void {
  hiddenTypes.clear()
  hiddenRelations.clear()
  hiddenStatuses.clear()
  hiddenStages.clear()
}

function colorFor(type: string): string {
  let hash = 0
  for (const char of type)
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  return TYPE_COLORS[Math.abs(hash) % TYPE_COLORS.length]!
}

function hashPosition(id: string): Point {
  let hash = 2166136261
  for (const char of id) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  const angle = ((hash >>> 0) % 360) * Math.PI / 180
  const radius = 100 + ((hash >>> 8) % 260)
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

function rebuildLayout(nextGraph: ViewerGraph): void {
  simulation?.stop()
  const previous = new Map(nodes.value.map(node => [node.id, node]))
  nodes.value = nextGraph.nodes.map((node) => {
    const old = previous.get(node.id)
    const initial = hashPosition(node.id)
    return { ...node, x: old?.x ?? initial.x, y: old?.y ?? initial.y, fx: old?.fx, fy: old?.fy }
  })
  const links: LayoutLink[] = nextGraph.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target }))
  simulation = forceSimulation<LayoutNode>(nodes.value)
    .randomSource(seedRandom(42))
    .force('link', forceLink<LayoutNode, LayoutLink>(links).id(node => node.id).distance(cardMode.value ? 210 : 90).strength(0.22))
    .force('charge', forceManyBody().strength(cardMode.value ? -540 : -170))
    .force('center', forceCenter(0, 0).strength(0.08))
    .force('x', forceX(0).strength(0.025))
    .force('y', forceY(0).strength(0.025))
    .force('collision', forceCollide<LayoutNode>().radius(cardMode.value ? 98 : 24).iterations(2))
    .alphaDecay(0.035)
    .on('tick', () => positionsVersion.value++)
}

function seedRandom(seed: number): () => number {
  return () => {
    seed = Math.imul(1664525, seed) + 1013904223 | 0
    return (seed >>> 0) / 4294967296
  }
}

async function loadGraph(): Promise<void> {
  reloadError.value = ''
  try {
    const response = await fetch('/api/graph', { cache: 'no-store' })
    const payload = await response.json() as ViewerGraph | { error?: string }
    if (!response.ok)
      throw new Error('error' in payload ? payload.error : `HTTP ${response.status}`)
    graph.value = payload as ViewerGraph
    rebuildLayout(graph.value)
    await nextTick()
    if (loading.value) {
      fitGraph()
      setTimeout(fitGraph, 500)
    }
    const focus = new URLSearchParams(location.hash.slice(1)).get('node')
    if (focus && nodeById.value.has(focus))
      selectNode(focus, true)
  }
  catch (error) {
    reloadError.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    loading.value = false
  }
}

function fitGraph(): void {
  if (!canvas.value || !visibleNodes.value.length)
    return
  const bounds = canvas.value.getBoundingClientRect()
  const xs = visibleNodes.value.map(node => node.x)
  const ys = visibleNodes.value.map(node => node.y)
  const minX = Math.min(...xs) - 120
  const maxX = Math.max(...xs) + 120
  const minY = Math.min(...ys) - 100
  const maxY = Math.max(...ys) + 100
  transform.scale = Math.min(1.2, Math.max(0.18, Math.min(bounds.width / (maxX - minX), bounds.height / (maxY - minY))))
  transform.x = bounds.width / 2 - ((minX + maxX) / 2) * transform.scale
  transform.y = bounds.height / 2 - ((minY + maxY) / 2) * transform.scale
}

function resetLayout(): void {
  if (graph.value) {
    nodes.value = []
    rebuildLayout(graph.value)
    setTimeout(fitGraph, 450)
  }
}

function toggleMode(): void {
  cardMode.value = !cardMode.value
  localStorage.setItem('ontograph-node-mode', cardMode.value ? 'card' : 'dot')
  if (graph.value)
    rebuildLayout(graph.value)
}

function toggleTheme(): void {
  dark.value = !dark.value
  localStorage.setItem('ontograph-theme', dark.value ? 'dark' : 'light')
}

function selectNode(id: string, center = false): void {
  selectedId.value = id
  history.replaceState(null, '', `#node=${encodeURIComponent(id)}`)
  if (center) {
    const node = nodeById.value.get(id)
    const bounds = canvas.value?.getBoundingClientRect()
    if (node && bounds) {
      transform.x = bounds.width * 0.46 - node.x * transform.scale
      transform.y = bounds.height / 2 - node.y * transform.scale
    }
  }
}

function clearSelection(): void {
  selectedId.value = ''
  history.replaceState(null, '', location.pathname + location.search)
}

function relatedNode(edge: ViewerEdge, direction: 'in' | 'out'): ViewerNode | undefined {
  return nodeById.value.get(direction === 'in' ? edge.source : edge.target)
}

function formatProperty(value: unknown): string {
  if (value == null)
    return '—'
  if (Array.isArray(value)) {
    if (value.every(item => typeof item !== 'object' || item == null))
      return value.join(', ') || '—'
    return `${value.length} items`
  }
  if (typeof value === 'object')
    return JSON.stringify(value)
  return String(value)
}

function edgePath(edge: ViewerEdge): string {
  void positionsVersion.value
  const source = nodeById.value.get(edge.source)
  const target = nodeById.value.get(edge.target)
  if (!source || !target)
    return ''
  if (source.id === target.id)
    return `M ${source.x} ${source.y - 20} C ${source.x + 52} ${source.y - 76}, ${source.x + 72} ${source.y + 35}, ${source.x + 12} ${source.y + 18}`
  const dx = target.x - source.x
  const dy = target.y - source.y
  const length = Math.hypot(dx, dy) || 1
  const curve = ((edge.id.length % 3) - 1) * 18
  const mx = (source.x + target.x) / 2 - dy / length * curve
  const my = (source.y + target.y) / 2 + dx / length * curve
  return `M ${source.x} ${source.y} Q ${mx} ${my} ${target.x} ${target.y}`
}

function nodeTransform(node: LayoutNode): string {
  void positionsVersion.value
  return `translate(${node.x * transform.scale}px, ${node.y * transform.scale}px) scale(${Math.min(1, transform.scale)})`
}

function nodeClass(node: LayoutNode): Record<string, boolean> {
  return {
    'selected': node.id === selectedId.value,
    'neighbor': neighborIds.value.has(node.id),
    'faded': Boolean(selectedId.value && node.id !== selectedId.value && !neighborIds.value.has(node.id)),
    'dot': !cardMode.value,
    'has-workflow': Boolean(node.workflow),
    'completed': isCompleted(node)
  }
}

function screenToGraph(event: PointerEvent): Point {
  const bounds = canvas.value!.getBoundingClientRect()
  return {
    x: (event.clientX - bounds.left - transform.x) / transform.scale,
    y: (event.clientY - bounds.top - transform.y) / transform.scale
  }
}

function startNodeDrag(event: PointerEvent, node: LayoutNode): void {
  event.stopPropagation()
  dragNode = node
  const point = screenToGraph(event)
  node.fx = point.x
  node.fy = point.y
  simulation?.alphaTarget(0.2).restart()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveNode(event: PointerEvent): void {
  if (!dragNode)
    return
  const point = screenToGraph(event)
  dragNode.fx = point.x
  dragNode.fy = point.y
}

function endNodeDrag(event: PointerEvent, node: LayoutNode): void {
  if (dragNode !== node)
    return
  simulation?.alphaTarget(0)
  dragNode = null
  ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
}

function startPan(event: PointerEvent): void {
  const element = canvas.value
  if (!element || event.target !== element)
    return
  panStart = { x: event.clientX - transform.x, y: event.clientY - transform.y }
  element.setPointerCapture(event.pointerId)
}

function movePan(event: PointerEvent): void {
  if (!panStart)
    return
  transform.x = event.clientX - panStart.x
  transform.y = event.clientY - panStart.y
}

function endPan(event: PointerEvent): void {
  if (!panStart)
    return
  panStart = null
  canvas.value?.releasePointerCapture(event.pointerId)
}

function zoomAt(delta: number, clientX?: number, clientY?: number): void {
  if (!canvas.value)
    return
  const bounds = canvas.value.getBoundingClientRect()
  const x = (clientX ?? bounds.left + bounds.width / 2) - bounds.left
  const y = (clientY ?? bounds.top + bounds.height / 2) - bounds.top
  const next = Math.min(2.4, Math.max(0.15, transform.scale * delta))
  transform.x = x - (x - transform.x) * next / transform.scale
  transform.y = y - (y - transform.y) * next / transform.scale
  transform.scale = next
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  zoomAt(wheelZoomFactor(event), event.clientX, event.clientY)
}

function toggleSet(set: Set<string>, value: string): void {
  if (set.has(value))
    set.delete(value)
  else
    set.add(value)
}

watch(dark, value => document.documentElement.classList.toggle('dark', value), { immediate: true })
onMounted(loadGraph)
onBeforeUnmount(() => simulation?.stop())
</script>

<template>
  <main class="app-shell">
    <header class="topbar glass">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"><Network :size="19" :stroke-width="2.2" /></span>
        <div>
          <strong>Ontograph</strong>
          <span>Inspector</span>
        </div>
      </div>
      <label class="search">
        <Search :size="15" aria-hidden="true" />
        <input v-model="query" type="search" placeholder="Search entities by name or ID" aria-label="Search entities">
        <kbd v-if="query">{{ visibleNodes.length }}</kbd>
      </label>
      <div class="header-actions">
        <span class="stats">
          {{ visibleNodes.length }} nodes · {{ visibleEdges.length }} relations
          <template v-if="taskNodes.length"> · {{ completedTaskCount }}/{{ taskNodes.length }} tasks closed</template>
        </span>
        <button class="icon-button" type="button" :aria-label="dark ? 'Use light theme' : 'Use dark theme'" @click="toggleTheme">
          <Sun v-if="dark" :size="17" />
          <Moon v-else :size="17" />
        </button>
      </div>
    </header>

    <section class="workspace">
      <aside class="filters glass">
        <div class="panel-heading">
          <strong>Filters</strong>
          <button v-if="hiddenTypes.size || hiddenRelations.size || hiddenStatuses.size || hiddenStages.size" type="button" class="text-button" @click="resetFilters">
            Reset
          </button>
        </div>
        <div class="filter-section">
          <span class="filter-label">Entity types</span>
          <label v-for="type in graph?.entityTypes" :key="type" class="filter-row">
            <input type="checkbox" :checked="!hiddenTypes.has(type)" @change="toggleSet(hiddenTypes, type)">
            <span class="type-dot" :style="{ background: colorFor(type) }" />
            <span>{{ type }}</span>
            <small>{{ nodes.filter(node => node.type === type).length }}</small>
          </label>
        </div>
        <div v-if="workflowStatuses.length" class="filter-section">
          <span class="filter-label">Task status</span>
          <label v-for="status in workflowStatuses" :key="status" class="filter-row">
            <input type="checkbox" :checked="!hiddenStatuses.has(status)" @change="toggleSet(hiddenStatuses, status)">
            <span class="type-dot status-dot" :style="{ background: statusColor(status) }" />
            <span>{{ statusLabel(status) }}</span>
            <small>{{ statusCount(status) }}</small>
          </label>
        </div>
        <div v-if="workflowStages.length" class="filter-section">
          <span class="filter-label">Current stage</span>
          <label v-for="stage in workflowStages" :key="stage" class="filter-row">
            <input type="checkbox" :checked="!hiddenStages.has(stage)" @change="toggleSet(hiddenStages, stage)">
            <span class="stage-mark" />
            <span :title="stage">{{ stage }}</span>
            <small>{{ stageCount(stage) }}</small>
          </label>
        </div>
        <div class="filter-section relation-filters">
          <span class="filter-label">Relations</span>
          <label v-for="relation in graph?.relationTypes" :key="relation" class="filter-row">
            <input type="checkbox" :checked="!hiddenRelations.has(relation)" @change="toggleSet(hiddenRelations, relation)">
            <span class="relation-swatch" />
            <span :title="relation">{{ relation }}</span>
            <small>{{ graph?.edges.filter(edge => edge.relation === relation).length }}</small>
          </label>
        </div>
      </aside>

      <div
        ref="canvas"
        class="graph-canvas"
        :class="{ panning: panStart }"
        @pointerdown="startPan"
        @pointermove="movePan"
        @pointerup="endPan"
        @pointercancel="endPan"
        @wheel="onWheel"
        @dblclick.self="clearSelection"
      >
        <div v-if="loading" class="center-state glass">
          <span class="spinner" />Loading graph…
        </div>
        <div v-else-if="!graph?.nodes.length" class="center-state glass">
          The ontology is empty.
        </div>
        <div v-if="reloadError" class="error-toast glass" role="alert">
          <strong>Could not load graph</strong><span>{{ reloadError }}</span><button type="button" @click="loadGraph">
            Try again
          </button>
        </div>

        <div class="world" :style="{ transform: `translate(${transform.x}px, ${transform.y}px)` }">
          <svg class="edges" aria-hidden="true">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
              <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            <g class="edge-layer" :transform="`translate(5000 5000) scale(${transform.scale})`">
              <g v-for="edge in visibleEdges" :key="edge.id" class="edge" :class="{ active: selectedEdgeIds.has(edge.id), faded: selectedId && !selectedEdgeIds.has(edge.id) }">
                <path :d="edgePath(edge)" :marker-end="selectedEdgeIds.has(edge.id) ? 'url(#arrow-active)' : 'url(#arrow)'" />
                <text v-if="selectedEdgeIds.has(edge.id)">
                  <textPath :href="`#edge-${edge.id}`" startOffset="50%">{{ edge.label }}</textPath>
                </text>
                <path :id="`edge-${edge.id}`" class="label-path" :d="edgePath(edge)" />
              </g>
            </g>
          </svg>

          <button
            v-for="node in visibleNodes"
            :key="node.id"
            type="button"
            class="graph-node"
            :class="nodeClass(node)"
            :style="{ 'transform': nodeTransform(node), '--node-color': colorFor(node.type), '--status-color': statusColor(node.workflow?.status) }"
            :aria-label="`${node.name}, ${node.type}`"
            @click.stop="selectNode(node.id)"
            @pointerdown="startNodeDrag($event, node)"
            @pointermove="moveNode"
            @pointerup="endNodeDrag($event, node)"
            @pointercancel="endNodeDrag($event, node)"
          >
            <span class="node-icon">{{ node.type.slice(0, 1).toUpperCase() }}</span>
            <span v-if="cardMode" class="node-copy">
              <span class="node-title-row">
                <strong>{{ node.name }}</strong>
                <span v-if="node.workflow" class="status-badge"><Check v-if="isCompleted(node)" :size="9" />{{ statusLabel(node.workflow.status) }}</span>
              </span>
              <small v-if="node.workflow?.stage" class="node-stage">Stage · {{ node.workflow.stage }}</small>
              <small v-else>{{ node.type }} · {{ node.incomingCount + node.outgoingCount }} links</small>
              <span v-if="node.workflow && goalProgress(node).total" class="node-progress">
                <span class="progress-track"><span :style="{ width: `${goalProgress(node).percent}%` }" /></span>
                <small>{{ goalProgress(node).achieved }}/{{ goalProgress(node).total }}</small>
              </span>
            </span>
            <span v-if="!cardMode" class="dot-label">{{ node.name }}</span>
          </button>
        </div>

        <div class="toolbar glass" aria-label="Graph controls">
          <button type="button" title="Zoom out" aria-label="Zoom out" @click="zoomAt(0.89)">
            <ZoomOut :size="17" />
          </button>
          <button type="button" title="Fit graph" aria-label="Fit graph" @click="fitGraph">
            <Focus :size="17" />
          </button>
          <button type="button" title="Zoom in" aria-label="Zoom in" @click="zoomAt(1.12)">
            <ZoomIn :size="17" />
          </button>
          <span class="toolbar-divider" />
          <button type="button" :class="{ active: !cardMode }" :title="cardMode ? 'Use dot nodes' : 'Use card nodes'" :aria-label="cardMode ? 'Use dot nodes' : 'Use card nodes'" @click="toggleMode">
            <CircleDot v-if="cardMode" :size="17" />
            <Square v-else :size="17" />
          </button>
          <button type="button" title="Reorganize graph" aria-label="Reorganize graph" @click="resetLayout">
            <RefreshCcw :size="17" />
          </button>
          <button type="button" title="Reload data" aria-label="Reload data" @click="loadGraph">
            <RefreshCw :size="17" />
          </button>
        </div>
      </div>

      <Transition name="drawer">
        <aside v-if="selected" class="relation-drawer glass" aria-label="Entity relationships">
          <header class="drawer-header">
            <div class="drawer-title">
              <span class="node-icon" :style="{ '--node-color': colorFor(selected.type) }">{{ selected.type.slice(0, 1).toUpperCase() }}</span>
              <div><strong>{{ selected.name }}</strong><span>{{ selected.type }}</span></div>
            </div>
            <button class="icon-button" type="button" aria-label="Close details" @click="clearSelection">
              <X :size="18" />
            </button>
          </header>
          <code class="entity-id">{{ selected.id }}</code>

          <section v-if="selected.workflow" class="drawer-section workflow-section">
            <h2>Task overview</h2>
            <div class="workflow-summary">
              <div>
                <span>Status</span>
                <strong class="summary-status" :style="{ '--status-color': statusColor(selected.workflow.status) }">
                  <span />{{ statusLabel(selected.workflow.status) }}
                </strong>
              </div>
              <div>
                <span>Current stage</span>
                <strong>{{ selected.workflow.stage || 'Unstaged' }}</strong>
              </div>
              <div>
                <span>Goal progress</span>
                <strong>{{ goalProgress(selected).achieved }} / {{ goalProgress(selected).total }}</strong>
              </div>
              <div v-if="selected.workflow.milestone">
                <span>Marker</span>
                <strong class="milestone-label"><Flag :size="12" /> Milestone</strong>
              </div>
              <div v-if="selected.workflow.completedAt">
                <span>Completed at</span>
                <strong>{{ selected.workflow.completedAt }}</strong>
              </div>
            </div>
            <div v-if="goalProgress(selected).total" class="drawer-progress">
              <span :style="{ width: `${goalProgress(selected).percent}%` }" />
            </div>
          </section>

          <section v-if="selectedGoals.length" class="drawer-section">
            <h2>Goals <span>{{ selectedGoals.length }}</span></h2>
            <div class="goal-list">
              <div v-for="goal in selectedGoals" :key="goal.id" class="goal-row" :class="`goal-${goal.status}`">
                <span class="goal-check"><Check v-if="goal.status === 'achieved'" :size="12" /></span>
                <span><strong>{{ goal.text }}</strong><small>{{ goal.stage || 'Overall' }}</small></span>
              </div>
            </div>
          </section>

          <section v-if="Object.keys(selectedProperties).length" class="drawer-section">
            <h2>Properties</h2>
            <dl class="properties">
              <template v-for="(value, key) in selectedProperties" :key="key">
                <dt>{{ key }}</dt><dd>{{ formatProperty(value) }}</dd>
              </template>
            </dl>
          </section>

          <section class="drawer-section">
            <h2>Incoming <span>{{ incoming.length }}</span></h2>
            <div v-if="!incoming.length" class="empty-list">
              No incoming relationships
            </div>
            <button v-for="edge in incoming" :key="edge.id" type="button" class="relation-row" @click="selectNode(edge.source, true)">
              <span class="relation-direction"><ArrowLeft :size="15" /></span>
              <span><strong>{{ relatedNode(edge, 'in')?.name ?? edge.source }}</strong><small>{{ edge.relation }}</small></span>
            </button>
          </section>

          <section class="drawer-section">
            <h2>Outgoing <span>{{ outgoing.length }}</span></h2>
            <div v-if="!outgoing.length" class="empty-list">
              No outgoing relationships
            </div>
            <button v-for="edge in outgoing" :key="edge.id" type="button" class="relation-row" @click="selectNode(edge.target, true)">
              <span class="relation-direction"><ArrowRight :size="15" /></span>
              <span><strong>{{ relatedNode(edge, 'out')?.name ?? edge.target }}</strong><small>{{ edge.relation }}</small></span>
            </button>
          </section>
        </aside>
      </Transition>
    </section>
  </main>
</template>
