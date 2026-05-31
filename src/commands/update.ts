import type { OntologyStore } from '../store'
import type { Entity } from '../types'
import { consola } from 'consola'
import { parseKeyValue } from '../utils'

export function entityUpdate(
  store: OntologyStore,
  fullId: string,
  name: string | undefined,
  props: string[]
): void {
  const extra = parseKeyValue(props)
  const patch: Partial<Entity> = {
    ...extra
  }

  if (name)
    patch.name = name

  if (Object.keys(patch).length === 0)
    throw new Error('Nothing to update use --name or --prop')

  store.updateEntity(fullId, patch)
  consola.success(`Updated: ${fullId}`)
  consola.info('Patch:', patch)
}
