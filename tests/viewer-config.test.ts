import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadViewerConfig, matchConfiguredRule } from '../src/viewer/config'

const tempDirs: string[] = []

afterEach(() => {
  for (const directory of tempDirs.splice(0))
    fs.rmSync(directory, { recursive: true, force: true })
})

function tempDir(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ontograph-viewer-config-'))
  tempDirs.push(directory)
  return directory
}

describe('viewer config', () => {
  it('uses generic defaults when no config exists', () => {
    const config = loadViewerConfig(tempDir())
    expect(config).toMatchObject({ version: 1, viewer: { title: 'Ontograph', defaultNodeMode: 'card' }, workflows: {} })
  })

  it('loads workflow semantics and presentation rules', () => {
    const directory = tempDir()
    fs.writeFileSync(path.join(directory, 'viewer.yaml'), `
version: 1
viewer:
  title: Issues
entities:
  knowledge:
    defaultVisible: false
workflows:
  issue:
    entityTypes: [issue]
    fields:
      status: state
    statuses:
      resolved:
        label: Resolved
        color: "#22a06b"
        completed: true
        defaultVisible: false
relations:
  "role_*":
    label: Role
    defaultVisible: false
`)

    const config = loadViewerConfig(directory)
    expect(config.workflows.issue?.fields.status).toBe('state')
    expect(config.workflows.issue?.statuses.resolved?.completed).toBe(true)
    expect(config.workflows.issue?.statuses.resolved?.defaultVisible).toBe(false)
    expect(config.entities.knowledge?.defaultVisible).toBe(false)
    expect(matchConfiguredRule(config.relations, 'role_owner')).toMatchObject({ label: 'Role', defaultVisible: false })
  })

  it('rejects invalid configuration before serving the viewer', () => {
    const directory = tempDir()
    fs.writeFileSync(path.join(directory, 'viewer.yaml'), 'version: 2\n')
    expect(() => loadViewerConfig(directory)).toThrow('Invalid viewer config')
  })
})
