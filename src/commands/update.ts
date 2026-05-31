import type { OntologyStore } from '../store'
import type { Entity } from '../types'
import { consola } from 'consola'
import { parseEntityId, parseKeyValue } from '../utils'

export function entityUpdate(
  store: OntologyStore,
  props: string[],
  name: string | undefined,
  fullId: string
): void {
  const { type } = parseEntityId(fullId)
  const arrayFields = store.getArrayFieldsForType(type)
  const extra = parseKeyValue(props, arrayFields)
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
