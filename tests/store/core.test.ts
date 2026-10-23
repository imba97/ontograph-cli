import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OntologyStore } from '../../src/core'
import { createStore } from './helpers'

describe('embeddable core', () => {
  it('reads an absent graph without creating directories', () => {
    const parent = createStore().getDataDir()
    const directory = path.join(parent, 'absent')
    const store = new OntologyStore({ dataDir: directory, readOnly: true, strict: true })
    expect(store.getGraph()).toEqual({ entities: {}, relations: [] })
    expect(() => store.addEntity('todo_abcdef123456', { type: 'todo', name: 'Task' })).toThrow('read only')
    expect(fs.existsSync(directory)).toBe(false)
  })

  it('rejects corrupt graph data in strict mode', () => {
    const original = createStore()
    original.addEntity('todo_abcdef123456', { type: 'todo', name: 'Task' })
    fs.writeFileSync(path.join(original.getDataDir(), 'entities/todo/abcdef123456.yaml'), 'broken: [')
    expect(() => new OntologyStore({ dataDir: original.getDataDir(), strict: true }).getGraph()).toThrow('Cannot read graph YAML')
  })

  it('commits entities, relation definitions and relations together', () => {
    const original = createStore()
    original.transaction((store) => {
      store.defineRelationType('assists', { name: '协助人', fromTypes: ['human'], toTypes: ['todo'] })
      store.addEntity('human_111122223333', { type: 'human', name: 'Alice' })
      store.addEntity('todo_444455556666', { type: 'todo', name: 'Task' })
      store.addRelation('human_111122223333', 'assists', 'todo_444455556666')
    })
    const graph = new OntologyStore({ dataDir: original.getDataDir(), strict: true }).getGraph()
    expect(Object.keys(graph.entities)).toHaveLength(2)
    expect(graph.relations).toHaveLength(1)
    expect(original.getGraph().relations).toHaveLength(1)
    expect(fs.existsSync(`${original.getDataDir()}.transaction.json`)).toBe(false)
  })

  it('leaves the original graph unchanged when a transaction fails', () => {
    const original = createStore()
    original.addEntity('todo_abcdef123456', { type: 'todo', name: 'Before' })
    expect(() => original.transaction((store) => {
      store.updateEntity('todo_abcdef123456', { name: 'After' })
      store.addRelation('todo_abcdef123456', 'missing', 'todo_abcdef123456')
    })).toThrow()
    expect(new OntologyStore({ dataDir: original.getDataDir() }).getGraph().entities.todo_abcdef123456.name).toBe('Before')
    expect(fs.existsSync(`${original.getDataDir()}.transaction.json`)).toBe(false)
  })
})
