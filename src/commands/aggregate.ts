import type { OntologyStore } from '../store'
import { consola } from 'consola'
import { ALL_RELATION_TYPES } from '../schema'

export function entityAggregate(
  store: OntologyStore,
  field: string,
  type?: string
): void {
  const results = store.aggregate(type, field)

  if (results.length === 0) {
    consola.info('No data to aggregate')
    return
  }

  consola.log(`  Field: ${field}${type ? ` (type: ${type})` : ''}`)
  for (const r of results) {
    consola.log(`  ${r.key}  ${r.count}`)
  }
}

export function entityPath(
  store: OntologyStore,
  from: string,
  to: string,
  maxDepth?: number
): void {
  try {
    const result = maxDepth
      ? store.findPath(from, to, maxDepth)
      : store.findPath(from, to)

    if (!result) {
      consola.info(`No path found between ${from} and ${to}`)
      return
    }

    consola.success(`Path (${result.path.length} hops):`)
    for (let i = 0; i < result.path.length; i++) {
      const nodeId = result.path[i]
      if (i === 0) {
        consola.log(`  ${nodeId}`)
      }
      else {
        const prevId = result.path[i - 1]
        const rel = result.relations[i - 1]
        const arrow = rel.from === prevId ? '→' : '←'
        consola.log(`    ${arrow} [${rel.rel}] ${arrow} ${nodeId}`)
      }
    }
  }
  catch (err) {
    consola.error(String(err))
  }
}

export function entityQuery(
  store: OntologyStore,
  type?: string,
  status?: string,
  tags?: string[]
): void {
  const results = store.query((entity) => {
    if (type && entity.type !== type)
      return false
    if (status && entity.status !== status)
      return false
    if (tags && tags.length > 0) {
      const entityTags: string[] = Array.isArray(entity.tags) ? entity.tags : []
      if (!tags.every(t => entityTags.includes(t)))
        return false
    }
    return true
  })

  if (results.length === 0) {
    consola.info('No results')
    return
  }

  for (const r of results) {
    consola.log(`  ${r.id}  ${r.entity.name} (${r.entity.type})`)
  }
}

export function printRelationTypes(): void {
  consola.info('Available relation types:')
  for (const rel of ALL_RELATION_TYPES) {
    consola.log(`  ${rel}`)
  }
}
