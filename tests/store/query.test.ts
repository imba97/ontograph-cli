import fs from 'node:fs'
import path from 'node:path'
import { consola } from 'consola'
import { describe, expect, it, vi } from 'vitest'
import { OntologyStore } from '../../src/store'
import { createStore, seedGraph } from './helpers'

describe('store query', () => {
  it('should query related entities (outgoing)', () => {
    const store = createStore()
    seedGraph(
      store,
      [
        ['person_1111aaaa', { type: 'person', name: 'Alice' }],
        ['project_2222bbbb', { type: 'project', name: 'Project B' }],
        ['project_3333cccc', { type: 'project', name: 'Project C' }]
      ],
      [
        ['person_1111aaaa', 'owns', 'project_2222bbbb'],
        ['person_1111aaaa', 'owns', 'project_3333cccc']
      ]
    )

    const out = store.related('person_1111aaaa')
    expect(out).toHaveLength(2)

    const byRel = store.related('person_1111aaaa', 'owns')
    expect(byRel).toHaveLength(2)

    const filtered = store.related('person_1111aaaa', 'contributes')
    expect(filtered).toHaveLength(0)
  })

  it('should query related entities (incoming)', () => {
    const store = createStore()
    seedGraph(
      store,
      [
        ['person_4444dddd', { type: 'person', name: 'Alice' }],
        ['project_5555eeee', { type: 'project', name: 'Project B' }]
      ],
      [['person_4444dddd', 'owns', 'project_5555eeee']]
    )

    const inFrom = store.related('project_5555eeee')
    expect(inFrom).toHaveLength(1)
    expect(inFrom[0].direction).toBe('in')
    expect(inFrom[0].rel).toBe('owns')
  })

  it('should search entities by name or id', () => {
    const store = createStore()
    seedGraph(store, [
      ['person_abcd1234', { type: 'person', name: 'imba久期' }],
      ['project_efab5678', { type: 'project', name: '网站重构' }]
    ])

    const byName = store.search('久期')
    expect(byName).toHaveLength(1)
    expect(byName[0].id).toBe('person_abcd1234')

    const byId = store.search('abcd1234')
    expect(byId).toHaveLength(1)

    const noMatch = store.search('nonexistent')
    expect(noMatch).toHaveLength(0)
  })

  it('should search with type filter', () => {
    const store = createStore()
    seedGraph(store, [
      ['person_6666ffff', { type: 'person', name: 'Alice' }],
      ['project_7777aaaa', { type: 'project', name: 'Alice Project' }]
    ])

    const both = store.search('alice')
    expect(both).toHaveLength(2)

    const personsOnly = store.search('alice', 'person')
    expect(personsOnly).toHaveLength(1)
    expect(personsOnly[0].id).toBe('person_6666ffff')
  })

  it('should list entities', () => {
    const store = createStore()
    seedGraph(store, [
      ['person_8888bbbb', { type: 'person', name: 'Alice' }],
      ['project_9999cccc', { type: 'project', name: 'Project B' }]
    ])

    const all = store.listEntities()
    expect(all).toHaveLength(2)

    const persons = store.listEntities('person')
    expect(persons).toHaveLength(1)
  })

  it('should list types', () => {
    const store = createStore()
    seedGraph(store, [
      ['person_aaaabbbb', { type: 'person', name: 'Alice' }],
      ['project_bbbbcccc', { type: 'project', name: 'Project B' }],
      ['task_ccccdddd', { type: 'task', name: 'Task C' }]
    ])

    const types = store.listTypes()
    expect(types).toEqual(['person', 'project', 'task'])
  })

  it('should skip relations pointing to missing entity files', () => {
    const store = createStore()
    seedGraph(
      store,
      [
        ['person_eeeeffff', { type: 'person', name: 'Owner' }],
        ['project_ddddeeee', { type: 'project', name: 'Broken Target' }]
      ],
      [['person_eeeeffff', 'owns', 'project_ddddeeee']]
    )

    const dataDir = store.getDataDir()
    const missingPath = path.join(dataDir, 'entities', 'project', 'ddddeeee.yaml')
    fs.unlinkSync(missingPath)

    const warnSpy = vi.spyOn(consola, 'warn').mockImplementation(() => {})
    try {
      const reloaded = new OntologyStore({ dataDir })
      expect(reloaded.related('person_eeeeffff')).toEqual([])
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping relation with missing entity'))
    }
    finally {
      warnSpy.mockRestore()
    }
  })
})
