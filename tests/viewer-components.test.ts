// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import type { ComponentPublicInstance } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GraphControls from '../viewer/src/components/GraphControls.vue'
import GraphFilters from '../viewer/src/components/GraphFilters.vue'
import TaskOverview from '../viewer/src/components/TaskOverview.vue'

function buttonByText(wrapper: VueWrapper<ComponentPublicInstance>, text: string) {
  const button = wrapper.findAll('button').find(candidate => candidate.text().includes(text))
  if (!button)
    throw new Error(`Missing button: ${text}`)
  return button
}

describe('viewer controls', () => {
  it('emits every graph control action', async () => {
    const wrapper = mount(GraphControls, { props: { cardMode: true } })

    await wrapper.get('[aria-label="Zoom out"]').trigger('click')
    await wrapper.get('[aria-label="Fit graph"]').trigger('click')
    await wrapper.get('[aria-label="Zoom in"]').trigger('click')
    await wrapper.get('[aria-label="Use dot nodes"]').trigger('click')
    await wrapper.get('[aria-label="Reorganize graph"]').trigger('click')
    await wrapper.get('[aria-label="Reload data"]').trigger('click')

    expect(wrapper.emitted()).toMatchObject({
      zoomOut: [[]],
      fit: [[]],
      zoomIn: [[]],
      toggleMode: [[]],
      reset: [[]],
      reload: [[]]
    })
  })
})

describe('viewer filters', () => {
  it('emits filter changes and milestone model updates', async () => {
    const wrapper = mount(GraphFilters, {
      props: {
        graph: {
          generatedAt: '2026-01-01T00:00:00.000Z',
          nodes: [],
          edges: [{ id: 'edge-1', source: 'todo-1', target: 'todo-2', relation: 'child_of', label: 'child_of' }],
          entityTypes: ['todo'],
          relationTypes: ['child_of']
        },
        nodes: [{ id: 'todo-1', type: 'todo', name: 'Task', properties: {}, incomingCount: 0, outgoingCount: 1, x: 0, y: 0 }],
        hiddenTypes: new Set(['todo']),
        hiddenRelations: new Set<string>(),
        hiddenStatuses: new Set<string>(),
        hiddenStages: new Set<string>(),
        workflowStatuses: ['in-progress'],
        workflowStages: ['Build'],
        milestoneCount: 1,
        onlyMilestones: false,
        colorFor: () => '#000',
        statusColor: () => '#111',
        statusLabel: (status?: string) => status ?? '',
        statusCount: () => 1,
        stageCount: () => 1
      }
    })

    await buttonByText(wrapper, 'Reset').trigger('click')
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[0]!.setValue(true)
    await checkboxes[1]!.setValue(true)
    await checkboxes[2]!.setValue(false)
    await checkboxes[3]!.setValue(false)
    await checkboxes[4]!.setValue(false)

    expect(wrapper.emitted('reset')).toHaveLength(1)
    expect(wrapper.emitted('toggleType')).toEqual([['todo']])
    expect(wrapper.emitted('update:onlyMilestones')).toEqual([[true]])
    expect(wrapper.emitted('toggleStatus')).toEqual([['in-progress']])
    expect(wrapper.emitted('toggleStage')).toEqual([['Build']])
    expect(wrapper.emitted('toggleRelation')).toEqual([['child_of']])
  })
})

describe('task overview', () => {
  it('renders metrics and emits drill-down actions', async () => {
    const wrapper = mount(TaskOverview, {
      props: {
        completedTaskCount: 2,
        taskCount: 5,
        achievedGoalCount: 3,
        goalCount: 7,
        milestoneCount: 1,
        workflowStatuses: ['in-progress'],
        workflowStages: ['Build'],
        statusColor: () => '#111',
        statusLabel: () => 'In progress',
        statusCount: () => 3,
        stageCount: () => 2
      }
    })

    expect(wrapper.text()).toContain('2 / 5')
    expect(wrapper.text()).toContain('3 / 7')
    await buttonByText(wrapper, 'In progress').trigger('click')
    await buttonByText(wrapper, 'Build').trigger('click')
    await wrapper.get('[aria-label="Close task overview"]').trigger('click')

    expect(wrapper.emitted('isolateStatus')).toEqual([['in-progress']])
    expect(wrapper.emitted('isolateStage')).toEqual([['Build']])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
