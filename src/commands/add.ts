import type { OntologyStore } from '../store'
import type { Entity } from '../types'
import { consola } from 'consola'
import { parseKeyValue } from '../utils'

export function entityAdd(
  store: OntologyStore,
  type: string,
  id: string,
  name: string,
  props: string[]
): void {
  const extra = parseKeyValue(props)

  const entity: Entity = {
    type,
    name,
    ...extra
  }

  store.addEntity(`${type}:${id}`, entity)
  consola.success(`Added ${type} "${id}":`, name)
  if (Object.keys(extra).length > 0) {
    consola.info('Properties:', extra)
  }
}
