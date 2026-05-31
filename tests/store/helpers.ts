import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { OntologyStore } from '../../src/store'

export function createStore(): OntologyStore {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ontograph-cli-test-'))
  return new OntologyStore({ dataDir: testDir })
}
