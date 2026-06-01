import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

export function getDefaultDataDir(): string {
  const hermesHome = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes')
  return path.join(hermesHome, 'data', 'ontograph-cli')
}

export type PropValue = string | number | string[]
export interface ParsedFieldDef {
  name: string
  type: 'string' | 'number' | 'array'
  required?: boolean
  enum?: string[]
}

export function normalizeOptionList(value: string | string[] | undefined): string[] {
  if (!value)
    return []
  return Array.isArray(value) ? value : [value]
}

export function parseKeyValue(
  args: string[],
  arrayFields: Iterable<string> = [],
  numberFields: Iterable<string> = []
): Record<string, PropValue> {
  const result: Record<string, PropValue> = {}
  const arrayFieldSet = new Set(arrayFields)
  const numberFieldSet = new Set(numberFields)
  for (const arg of args) {
    const eq = arg.indexOf('=')
    if (eq > 0 && eq < arg.length - 1) {
      const key = arg.slice(0, eq)
      const value = arg.slice(eq + 1)
      if (arrayFieldSet.has(key)) {
        result[key] = value.split(',').map(v => v.trim()).filter(Boolean)
      }
      else if (numberFieldSet.has(key)) {
        const parsed = Number(value)
        result[key] = Number.isFinite(parsed) ? parsed : value
      }
      else {
        result[key] = value
      }
    }
  }
  return result
}

export function parseFieldDefinition(field: string): ParsedFieldDef {
  const kvPairs = field.split(';').map(item => item.trim()).filter(Boolean)
  if (kvPairs.length === 0)
    throw new Error(`Invalid --field "${field}". Expected format: name=...;type=...`)

  const parsed: Record<string, string> = {}
  for (const pair of kvPairs) {
    const eq = pair.indexOf('=')
    if (eq <= 0 || eq === pair.length - 1) {
      throw new Error(`Invalid field segment "${pair}" in "${field}". Expected key=value`)
    }
    const key = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    parsed[key] = value
  }

  const name = parsed.name
  if (!name)
    throw new Error(`Invalid --field "${field}": missing "name"`)

  const type = parsed.type
  if (!type)
    throw new Error(`Invalid --field "${field}": missing "type"`)
  if (type !== 'string' && type !== 'number' && type !== 'array')
    throw new Error(`Invalid --field "${field}": type must be one of string, number, array`)

  const result: ParsedFieldDef = {
    name,
    type
  }

  if (parsed.required !== undefined) {
    const lowered = parsed.required.toLowerCase()
    if (lowered !== 'true' && lowered !== 'false')
      throw new Error(`Invalid --field "${field}": required must be true or false`)
    if (lowered === 'true')
      result.required = true
  }

  if (parsed.enum !== undefined) {
    const values = parsed.enum.split(',').map(item => item.trim()).filter(Boolean)
    if (values.length === 0)
      throw new Error(`Invalid --field "${field}": enum must contain at least one value`)
    result.enum = values
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
