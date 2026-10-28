<script setup lang="ts">
import { CircleDot, Focus, RefreshCcw, RefreshCw, Square, ZoomIn, ZoomOut } from '@lucide/vue'

defineProps<{ cardMode: boolean }>()

const emit = defineEmits<{
  zoomOut: []
  fit: []
  zoomIn: []
  toggleMode: []
  reset: []
  reload: []
}>()
</script>

<template>
  <div class="toolbar glass" aria-label="Graph controls">
    <button type="button" title="Zoom out" aria-label="Zoom out" @click="emit('zoomOut')">
      <ZoomOut :size="17" />
    </button>
    <button type="button" title="Fit graph" aria-label="Fit graph" @click="emit('fit')">
      <Focus :size="17" />
    </button>
    <button type="button" title="Zoom in" aria-label="Zoom in" @click="emit('zoomIn')">
      <ZoomIn :size="17" />
    </button>
    <span class="toolbar-divider" />
    <button type="button" :class="{ active: !cardMode }" :title="cardMode ? 'Use dot nodes' : 'Use card nodes'" :aria-label="cardMode ? 'Use dot nodes' : 'Use card nodes'" @click="emit('toggleMode')">
      <CircleDot v-if="cardMode" :size="17" />
      <Square v-else :size="17" />
    </button>
    <button type="button" title="Reorganize graph" aria-label="Reorganize graph" @click="emit('reset')">
      <RefreshCcw :size="17" />
    </button>
    <button type="button" title="Reload data" aria-label="Reload data" @click="emit('reload')">
      <RefreshCw :size="17" />
    </button>
  </div>
</template>
