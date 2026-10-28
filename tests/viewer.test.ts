import type { ViewerConfig } from '../src/viewer/config'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { projectViewerGraph } from '../src/viewer/projection'
import { startViewerServer } from '../src/viewer/server'
import { createStore, seedGraph } from './store/helpers'

const servers: Array<{ close: () => Promise<void> }> = []
const tempDirs: string[] = []
const workflowConfig: ViewerConfig = {
  version: 1,
  viewer: { title: 'Tasks', defaultNodeMode: 'card' },
  entities: {},
  relations: {},
  workflows: {
    task: {
      entityTypes: ['todo'],
      fields: { status: 'status', stage: 'stage', goals: 'goals', history: 'history', milestone: 'milestone', completedAt: 'completedAt' },
      hierarchy: { relation: 'child_of', direction: 'child-to-parent' },
      statuses: { 'in-progress': { label: 'In progress', color: '#6750d8', completed: false } }
    }
  },
  drawer: { tabs: [{ id: 'overview', label: 'Overview', when: 'always', components: [{ type: 'property-list' }] }] }
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
  for (const directory of tempDirs.splice(0))
    fs.rmSync(directory, { recursive: true, force: true })
})

describe('ontology viewer', () => {
  it('projects stable nodes edges and adjacency counts', () => {
    const graph = seedGraph(createStore(), [
      ['task_aaaaaaaaaaaa', { type: 'task', name: 'Inspect graph', notes: '<b>text</b>' }],
      ['project_bbbbbbbbbbbb', { type: 'project', name: 'Graph' }]
    ], [
      ['task_aaaaaaaaaaaa', 'depends_on', 'project_bbbbbbbbbbbb']
    ]).getGraph()

    expect(projectViewerGraph(graph, '2026-01-01T00:00:00.000Z')).toMatchObject({
      generatedAt: '2026-01-01T00:00:00.000Z',
      entityTypes: ['project', 'task'],
      relationTypes: ['depends_on'],
      nodes: [
        { id: 'project_bbbbbbbbbbbb', incomingCount: 1, outgoingCount: 0 },
        { id: 'task_aaaaaaaaaaaa', incomingCount: 0, outgoingCount: 1 }
      ],
      edges: [{
        source: 'task_aaaaaaaaaaaa',
        target: 'project_bbbbbbbbbbbb',
        relation: 'depends_on'
      }]
    })
  })

  it('projects workflow metadata without interpreting task progress', () => {
    const graph = seedGraph(createStore(), [
      ['todo_aaaaaaaaaaaa', {
        type: 'todo',
        name: 'Ship inspector',
        status: 'in-progress',
        stage: 'verification',
        completedAt: null,
        milestone: true,
        goals: [
          { id: 'goal-1', text: 'Build UI', status: 'achieved', scope: 'stage', stage: 'implementation' },
          { id: 'goal-2', text: 'Verify UI', status: 'pending', scope: 'stage', stage: 'verification' }
        ],
        history: [
          { id: 'history-1', at: '2026-01-01T00:00:00.000Z', kind: 'stage', text: 'Enter verification', from: 'implementation', to: 'verification' }
        ]
      }]
    ]).getGraph()

    expect(projectViewerGraph(graph, undefined, workflowConfig).nodes[0]?.workflow).toEqual({
      key: 'task',
      status: 'in-progress',
      statusLabel: 'In progress',
      statusColor: '#6750d8',
      completed: false,
      stage: 'verification',
      completedAt: null,
      milestone: true,
      goals: [
        { id: 'goal-1', text: 'Build UI', status: 'achieved', scope: 'stage', stage: 'implementation' },
        { id: 'goal-2', text: 'Verify UI', status: 'pending', scope: 'stage', stage: 'verification' }
      ],
      history: [
        { id: 'history-1', at: '2026-01-01T00:00:00.000Z', kind: 'stage', text: 'Enter verification', from: 'implementation', to: 'verification', stage: undefined }
      ],
      hierarchy: { relation: 'child_of', direction: 'child-to-parent' }
    })
  })

  it('serves the graph without allowing writes', async () => {
    const store = seedGraph(createStore(), [
      ['person_aaaaaaaaaaaa', { type: 'person', name: 'Ada' }]
    ])
    const assetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ontograph-viewer-assets-'))
    tempDirs.push(assetsDir)
    fs.writeFileSync(path.join(assetsDir, 'index.html'), '<h1>Viewer</h1>')
    const viewer = await startViewerServer({ dataDir: store.getDataDir(), assetsDir })
    servers.push(viewer)

    const graphResponse = await fetch(`${viewer.url}/api/graph`)
    expect(graphResponse.status).toBe(200)
    expect(await graphResponse.json()).toMatchObject({ nodes: [{ name: 'Ada' }] })

    const configResponse = await fetch(`${viewer.url}/api/config`)
    expect(configResponse.status).toBe(200)
    expect(await configResponse.json()).toMatchObject({ version: 1, viewer: { title: 'Ontograph' } })

    const writeResponse = await fetch(`${viewer.url}/api/graph`, { method: 'POST' })
    expect(writeResponse.status).toBe(405)
  })
})
