<script setup lang="ts">
import { BarChart3, X } from '@lucide/vue'

defineProps<{
  completedTaskCount: number
  taskCount: number
  achievedGoalCount: number
  goalCount: number
  milestoneCount: number
  workflowStatuses: string[]
  workflowStages: string[]
  statusColor: (status?: string) => string
  statusLabel: (status?: string) => string
  statusCount: (status: string) => number
  stageCount: (stage: string) => number
}>()

const emit = defineEmits<{
  close: []
  isolateStatus: [status: string]
  isolateStage: [stage: string]
}>()
</script>

<template>
  <aside class="task-overview glass" aria-label="Task overview">
    <header>
      <div><BarChart3 :size="16" /><strong>Task overview</strong></div>
      <button class="icon-button" type="button" aria-label="Close task overview" @click="emit('close')">
        <X :size="16" />
      </button>
    </header>
    <div class="overview-metrics">
      <div><span>Closed</span><strong>{{ completedTaskCount }} / {{ taskCount }}</strong></div>
      <div><span>Goals</span><strong>{{ achievedGoalCount }} / {{ goalCount }}</strong></div>
      <div><span>Milestones</span><strong>{{ milestoneCount }}</strong></div>
      <div><span>Stages</span><strong>{{ workflowStages.length }}</strong></div>
    </div>
    <section>
      <span class="overview-label">Status distribution</span>
      <button v-for="status in workflowStatuses" :key="status" type="button" class="overview-row" @click="emit('isolateStatus', status)">
        <span class="type-dot" :style="{ background: statusColor(status) }" /><span>{{ statusLabel(status) }}</span><strong>{{ statusCount(status) }}</strong>
      </button>
    </section>
    <section>
      <span class="overview-label">Current stages</span>
      <button v-for="stage in workflowStages" :key="stage" type="button" class="overview-row" @click="emit('isolateStage', stage)">
        <span class="stage-mark" /><span>{{ stage }}</span><strong>{{ stageCount(stage) }}</strong>
      </button>
    </section>
  </aside>
</template>
