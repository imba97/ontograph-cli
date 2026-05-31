import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

export function getDefaultDataDir(): string {
  const hermesHome = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes')
  return path.join(hermesHome, 'data', 'ontograph-cli')
}

export type PropValue = string | string[]

export function parseKeyValue(args: string[]): Record<string, PropValue> {
  const result: Record<string, PropValue> = {}
  for (const arg of args) {
    const eq = arg.indexOf('=')
    if (eq > 0 && eq < arg.length - 1) {
      const key = arg.slice(0, eq)
      const value = arg.slice(eq + 1)
      if (key === 'tags') {
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

/**
 * Parse "type:id" into { type, id }.
 * Throws if the id has no type prefix (no colon).
 */
export function parseEntityId(fullId: string): ParsedEntityId {
  const colon = fullId.indexOf(':')
  if (colon === -1)
    throw new Error(`Invalid entity id "${fullId}": missing type prefix (expected "type:id")`)
  return {
    type: fullId.slice(0, colon),
    id: fullId.slice(colon + 1)
  }
}
