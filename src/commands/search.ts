import type { OntologyStore } from '../store'
import { consola } from 'consola'

export function entitySearch(
  store: OntologyStore,
  query: string,
  type?: string
): void {
  const results = store.search(query, type)

  if (results.length === 0) {
    consola.info('No results found')
    return
  }

  for (const r of results) {
    consola.log(`  ${r.id}  ${r.entity.name} (${r.entity.type})`)
  }
}

export function entityList(
  store: OntologyStore,
  type?: string
): void {
  const results = store.listEntities(type)

  if (type) {
    consola.info(`Entities of type "${type}":`)
  }

  if (results.length === 0) {
    consola.info('No entities found')
    return
  }

  for (const r of results) {
    consola.log(`  ${r.id}  ${r.entity.name}`)
  }
}

export function entityTypes(store: OntologyStore): void {
  const types = store.listTypes()

  if (types.length === 0) {
    consola.info('No types found')
    return
  }

  consola.info('Entity types:')
  for (const t of types) {
    consola.log(`  ${t}`)
  }
}

export function entityRelated(
  store: OntologyStore,
  id: string,
  rel?: string
): void {
  const results = store.related(id, rel)

  if (results.length === 0) {
    consola.info('No relations found')
    return
  }

  for (const r of results) {
    const arrow = r.direction === 'out' ? '→' : '←'
    const fromLabel = r.direction === 'out' ? id : r.id
    const toLabel = r.direction === 'out' ? r.id : id
    consola.log(`  ${fromLabel} ${arrow} [${r.rel}] ${arrow} ${toLabel}`)
    consola.log(`    ${r.entity.name} (${r.entity.type})`)
  }
}
