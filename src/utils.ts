import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

export function getDefaultDataDir(): string {
  const hermesHome = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes')
  return path.join(hermesHome, 'data', 'ontograph-cli')
}

export function parseKeyValue(args: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const arg of args) {
    const eq = arg.indexOf('=')
    if (eq > 0 && eq < arg.length - 1)
      result[arg.slice(0, eq)] = arg.slice(eq + 1)
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
