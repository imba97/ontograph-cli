import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

export function getDefaultDataDir(): string {
  const hermesHome = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes')
  return path.join(hermesHome, 'data', 'ontograph-cli')
}

export type PropValue = string | string[]

export function normalizeOptionList(value: string | string[] | undefined): string[] {
  if (!value)
    return []
  return Array.isArray(value) ? value : [value]
}

export function parseKeyValue(args: string[], arrayFields: Iterable<string> = []): Record<string, PropValue> {
  const result: Record<string, PropValue> = {}
  const arrayFieldSet = new Set(arrayFields)
  for (const arg of args) {
    const eq = arg.indexOf('=')
    if (eq > 0 && eq < arg.length - 1) {
      const key = arg.slice(0, eq)
      const value = arg.slice(eq + 1)
      if (arrayFieldSet.has(key)) {
        result[key] = value.split(',').map(v => v.trim()).filter(Boolean)
      }
      else {
        result[key] = value
      }
    }
  }
  return result
}

export interface ParsedEntityId {
  type: string
  id: string
}

const TYPE_PATTERN = /^[a-z][\w-]*$/i
const GENERATED_ID_PATTERN = /^[a-f0-9]{8,}$/i

export function assertEntityType(type: string): string {
  const normalized = type.trim()
  if (!TYPE_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid entity type "${type}". Expected pattern: letters/numbers/_/- and must start with a letter`
    )
  }
  return normalized
}

export function buildEntityId(type: string, id: string): string {
  const normalizedType = assertEntityType(type)
  if (!GENERATED_ID_PATTERN.test(id)) {
    throw new Error(`Invalid generated id segment "${id}"`)
  }
  return `${normalizedType}_${id}`
}

export function generateEntityId(type: string): string {
  const normalizedType = assertEntityType(type)
  const segment = randomUUID().replaceAll('-', '').slice(0, 12)
  return `${normalizedType}_${segment}`
}

/**
 * Parse "type_random" into { type, id }.
 */
export function parseEntityId(entityId: string): ParsedEntityId {
  const separator = entityId.lastIndexOf('_')
  if (separator <= 0 || separator === entityId.length - 1) {
    throw new Error(
      `Invalid entity id "${entityId}". Expected generated id format: "type_randomhex"`
    )
  }
  const type = entityId.slice(0, separator)
  const id = entityId.slice(separator + 1)
  assertEntityType(type)
  if (!GENERATED_ID_PATTERN.test(id))
    throw new Error(`Invalid entity id "${entityId}". Expected generated suffix of at least 8 hex characters`)
  return {
    type,
    id
  }
}
