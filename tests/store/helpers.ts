import type { Entity } from '../../src/types'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach } from 'vitest'
import { OntologyStore } from '../../src/store'

const tempDirs = new Set<string>()

afterEach(() => {
  for (const dir of tempDirs)
    fs.rmSync(dir, { recursive: true, force: true })
  tempDirs.clear()
})

export function createStore(): OntologyStore {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ontograph-cli-test-'))
  tempDirs.add(testDir)
  return new OntologyStore({ dataDir: testDir })
}

export function seedGraph(
  store: OntologyStore,
  entities: Array<[id: string, entity: Entity]>,
  relations: Array<[from: string, rel: string, to: string]> = []
): OntologyStore {
  for (const [id, entity] of entities)
    store.addEntity(id, entity)

  for (const [from, rel, to] of relations)
    store.addRelation(from, rel, to)

  return store
}
