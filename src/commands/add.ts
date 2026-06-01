import type { OntologyStore } from '../store'
import type { Entity } from '../types'
import { consola } from 'consola'
import { generateEntityId, parseKeyValue } from '../utils'

export function entityAdd(
  store: OntologyStore,
  type: string,
  name: string | undefined,
  props: string[]
): void {
  const entityId = generateEntityId(type)
  const defaultName = name || entityId
  const arrayFields = store.getArrayFieldsForType(type)
  const numberFields = store.getNumberFieldsForType(type)
  const extra = parseKeyValue(props, arrayFields, numberFields)

  const entity: Entity = {
    type,
    name: defaultName,
    ...extra
  }

  store.addEntity(entityId, entity)
  consola.success(`Added ${type}: ${entityId}`)
  consola.info(`Name: ${defaultName}`)
  if (Object.keys(extra).length > 0) {
    consola.info('Properties:', extra)
  }
}
