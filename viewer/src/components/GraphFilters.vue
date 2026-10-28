<script setup lang="ts">
import type { LayoutNode, ViewerGraph } from '../types'
import { Flag } from '@lucide/vue'

defineProps<{
  graph: ViewerGraph | null
  nodes: LayoutNode[]
  hiddenTypes: Set<string>
  hiddenRelations: Set<string>
  hiddenStatuses: Set<string>
  hiddenStages: Set<string>
  workflowStatuses: string[]
  workflowStages: string[]
  milestoneCount: number
  colorFor: (type: string) => string
  entityLabel: (type: string) => string
  relationLabel: (relation: string) => string
  statusColor: (status?: string) => string
  statusLabel: (status?: string) => string
  statusCount: (status: string) => number
  stageCount: (stage: string) => number
}>()

const emit = defineEmits<{
  reset: []
  toggleType: [value: string]
  toggleRelation: [value: string]
  toggleStatus: [value: string]
  toggleStage: [value: string]
}>()

const onlyMilestones = defineModel<boolean>('onlyMilestones', { required: true })
</script>

<template>
  <aside class="filters glass">
    <div class="panel-heading">
      <strong>Filters</strong>
      <button v-if="hiddenTypes.size || hiddenRelations.size || hiddenStatuses.size || hiddenStages.size || onlyMilestones" type="button" class="text-button" @click="emit('reset')">
        Reset
      </button>
    </div>
    <div class="filter-section">
      <span class="filter-label">Entity types</span>
      <label v-for="type in graph?.entityTypes" :key="type" class="filter-row">
        <input type="checkbox" :checked="!hiddenTypes.has(type)" @change="emit('toggleType', type)">
        <span class="type-dot" :style="{ background: colorFor(type) }" />
        <span>{{ entityLabel(type) }}</span>
        <small>{{ nodes.filter(node => node.type === type).length }}</small>
      </label>
    </div>
    <div v-if="workflowStatuses.length" class="filter-section">
      <span class="filter-label">Task status</span>
      <label v-if="milestoneCount" class="filter-row">
        <input v-model="onlyMilestones" type="checkbox">
        <Flag class="milestone-filter-icon" :size="12" />
        <span>Milestone focus</span>
        <small>{{ milestoneCount }}</small>
      </label>
      <label v-for="status in workflowStatuses" :key="status" class="filter-row">
        <input type="checkbox" :checked="!hiddenStatuses.has(status)" @change="emit('toggleStatus', status)">
        <span class="type-dot status-dot" :style="{ background: statusColor(status) }" />
        <span>{{ statusLabel(status) }}</span>
        <small>{{ statusCount(status) }}</small>
      </label>
    </div>
    <div v-if="workflowStages.length" class="filter-section">
      <span class="filter-label">Current stage</span>
      <label v-for="stage in workflowStages" :key="stage" class="filter-row">
        <input type="checkbox" :checked="!hiddenStages.has(stage)" @change="emit('toggleStage', stage)">
        <span class="stage-mark" />
        <span :title="stage">{{ stage }}</span>
        <small>{{ stageCount(stage) }}</small>
      </label>
    </div>
    <div class="filter-section relation-filters">
      <span class="filter-label">Relations</span>
      <label v-for="relation in graph?.relationTypes" :key="relation" class="filter-row">
        <input type="checkbox" :checked="!hiddenRelations.has(relation)" @change="emit('toggleRelation', relation)">
        <span class="relation-swatch" />
        <span :title="relation">{{ relationLabel(relation) }}</span>
        <small>{{ graph?.edges.filter(edge => edge.relation === relation).length }}</small>
      </label>
    </div>
  </aside>
</template>
