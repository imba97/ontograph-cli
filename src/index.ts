import process from 'node:process'
import { cac } from 'cac'
import { consola } from 'consola'
import { entityAdd } from './commands/add'
import {
  entityTypeAdd,
  entityTypeList,
  entityTypeRemove,
  entityTypeUpdate,
  entityTypeView
} from './commands/entity-type'
import {
  entityAggregate,
  entityList,
  entityPath,
  entityQuery,
  entityRelated,
  entitySearch,
  entityTypes,
  printRelationTypes
} from './commands/query'
import { entityRelate, entityUnrelate } from './commands/relate'
import {
  relationTypeAdd,
  relationTypeList,
  relationTypeRemove,
  relationTypeUpdate,
  relationTypeView
} from './commands/relation-type'
import { entityUpdate } from './commands/update'
import { OntologyStore } from './store'
import { getDefaultDataDir, normalizeOptionList } from './utils'

interface GlobalOptions {
  dataDir?: string
}

function getStore(options: GlobalOptions): OntologyStore {
  const dataDir = options.dataDir || getDefaultDataDir()
  return new OntologyStore({ dataDir })
}

const cli = cac('ontograph')

cli.option('--data-dir <dir>', 'Data directory', {
  default: getDefaultDataDir()
})

// ── Entity Commands ─────────────────────────────────────────────────────────

cli
  .command('add <type> <id>', 'Add a new entity')
  .option('-n, --name <name>', 'Entity name')
  .option('-p, --prop <key=value...>', 'Extra properties')
  .action((type: string, id: string, options) => {
    const store = getStore(options)
    const name = options.name || id
    const props = normalizeOptionList(options.prop)
    entityAdd(store, type, id, name, props)
  })

cli
  .command('update <id>', 'Update an existing entity')
  .option('-n, --name <name>', 'Entity name')
  .option('-p, --prop <key=value...>', 'Updated properties')
  .action((id: string, options) => {
    const store = getStore(options)
    const props = normalizeOptionList(options.prop)
    entityUpdate(store, props, options.name, id)
  })

cli
  .command('remove <id>', 'Remove an entity and all its relations')
  .action((id: string, options) => {
    const store = getStore(options)
    store.removeEntity(id)
    consola.success(`Removed: ${id}`)
  })

// ── Relation Commands ────────────────────────────────────────────────────────

cli
  .command('relate <from> <rel> <to>', 'Create a relation between entities')
  .action((from: string, rel: string, to: string, options) => {
    const store = getStore(options)
    entityRelate(store, from, rel, to)
  })

cli
  .command('unrelate <from> <rel> <to>', 'Remove a relation')
  .action((from: string, rel: string, to: string, options) => {
    const store = getStore(options)
    entityUnrelate(store, from, rel, to)
  })

cli
  .command('relations', 'List all available relation types')
  .action((_options) => {
    printRelationTypes()
  })

// ── Query Commands ─────────────────────────────────────────────────────────

cli
  .command('related <id>', 'Find related entities')
  .option('-r, --rel <rel>', 'Filter by relation type')
  .action((id: string, options) => {
    const store = getStore(options)
    entityRelated(store, id, options.rel)
  })

cli
  .command('search <query>', 'Search entities by name or id')
  .option('-t, --type <type>', 'Filter by entity type')
  .action((query: string, options) => {
    const store = getStore(options)
    entitySearch(store, query, options.type)
  })

cli
  .command('list [type]', 'List entities, optionally filtered by type')
  .action((type: string | undefined, options) => {
    const store = getStore(options)
    entityList(store, type)
  })

cli
  .command('types', 'List all entity types')
  .action((options) => {
    const store = getStore(options)
    entityTypes(store)
  })

// ── Advanced Query Commands ──────────────────────────────────────────────────

cli
  .command('aggregate', 'Aggregate entities by a field value')
  .option('-f, --field <field>', 'Field to aggregate by', { default: 'type' })
  .option('-t, --type <type>', 'Filter by entity type')
  .action((options) => {
    const store = getStore(options)
    entityAggregate(store, options.field, options.type)
  })

cli
  .command('path <from> <to>', 'Find shortest path between two entities (BFS)')
  .option('-d, --depth <n>', 'Max depth', { default: 5 })
  .action((from: string, to: string, options) => {
    const store = getStore(options)
    entityPath(store, from, to, options.depth)
  })

cli
  .command('query', 'Query entities by type, status, or tags')
  .option('-t, --type <type>', 'Filter by entity type')
  .option('-s, --status <status>', 'Filter by status')
  .option('--tag <tag...>', 'Filter by tags')
  .action((options) => {
    const store = getStore(options)
    entityQuery(store, options.type, options.status, options.tag)
  })

// ── Info ────────────────────────────────────────────────────────────────────

cli
  .command('info', 'Show data directory and stats')
  .action((options) => {
    const store = getStore(options)
    const graph = store.getGraph()
    const entityCount = Object.keys(graph.entities).length
    const relationCount = graph.relations.length
    consola.info(`Data: ${store.getDataDir()}`)
    consola.info(`Entities: ${entityCount}  |  Relations: ${relationCount}`)
  })

// ── Type Management ───────────────────────────────────────────────────────────

cli
  .command('entity-type <action> [name]', 'Entity type management: list, view, add, update, remove')
  .option('--name <name>', 'Display name')
  .option('--desc <description>', 'Description')
  .option('--field <fields...>', 'Field definitions (e.g. --field status:string:true)')
  .action((action: string, name: string | undefined, options) => {
    const store = getStore(options)
    switch (action) {
      case 'list':
        entityTypeList(store)
        break
      case 'view':
        if (!name)
          throw new Error('Name required for view')
        entityTypeView(store, name)
        break
      case 'add':
        if (!name)
          throw new Error('Name required for add')
        {
          const fields = (Array.isArray(options.field) ? options.field : options.field ? [options.field] : []).map((f: string) => {
            const parts = f.split(':')
            return {
              key: parts[0],
              type: parts[1] || 'string',
              required: parts[2] !== 'false',
              enum: parts[3] ? parts[3].split(',') : undefined
            }
          })
          entityTypeAdd(store, name, options.name || name, options.desc || '', fields)
        }
        break
      case 'remove':
        if (!name)
          throw new Error('Name required for remove')
        entityTypeRemove(store, name)
        break
      case 'update':
        if (!name)
          throw new Error('Name required for update')
        {
          const fields = options.field
            ? (Array.isArray(options.field) ? options.field : [options.field]).map((f: string) => {
                const parts = f.split(':')
                return {
                  key: parts[0],
                  type: parts[1] || 'string',
                  required: parts[2] !== 'false',
                  enum: parts[3] ? parts[3].split(',') : undefined
                }
              })
            : undefined
          entityTypeUpdate(store, name, options.name, options.desc, fields)
        }
        break
      default:
        throw new Error(`Unknown action: ${action}. Valid: list, view, add, remove, update`)
    }
  })

// ── Relation Type Management ───────────────────────────────────────────────────

cli
  .command('relation-type <action> [name]', 'Relation type management: list, view, add, update, remove')
  .option('--name <name>', 'Display name')
  .option('--desc <description>', 'Description')
  .option('--from <types...>', 'Allowed source entity types')
  .option('--to <types...>', 'Allowed target entity types')
  .action((action: string, name: string | undefined, options) => {
    const store = getStore(options)
    const fromTypes = Array.isArray(options.from) ? options.from : options.from ? [options.from] : []
    const toTypes = Array.isArray(options.to) ? options.to : options.to ? [options.to] : []
    switch (action) {
      case 'list':
        relationTypeList(store)
        break
      case 'view':
        if (!name)
          throw new Error('Name required for view')
        relationTypeView(store, name)
        break
      case 'add':
        if (!name)
          throw new Error('Name required for add')
        relationTypeAdd(
          store,
          name,
          options.name || name,
          options.desc || '',
          fromTypes,
          toTypes
        )
        break
      case 'remove':
        if (!name)
          throw new Error('Name required for remove')
        relationTypeRemove(store, name)
        break
      case 'update':
        if (!name)
          throw new Error('Name required for update')
        relationTypeUpdate(
          store,
          name,
          options.name,
          options.desc,
          options.from ? fromTypes : undefined,
          options.to ? toTypes : undefined
        )
        break
      default:
        throw new Error(`Unknown action: ${action}. Valid: list, view, add, remove, update`)
    }
  })

cli.help()
cli.version('0.1.0')

try {
  cli.parse()
}
catch (err) {
  consola.error(err)
  process.exit(1)
}
