import type { OntologyStore } from '../store'
import { consola } from 'consola'

export function entityRelate(
  store: OntologyStore,
  from: string,
  rel: string,
  to: string
): void {
  store.addRelation(from, rel, to)
  consola.success(`Related: ${from} --${rel}--> ${to}`)
}

export function entityUnrelate(
  store: OntologyStore,
  from: string,
  rel: string,
  to: string
): void {
  store.removeRelation(from, rel, to)
  consola.success(`Unrelated: ${from} -/-${rel}-/- ${to}`)
}
