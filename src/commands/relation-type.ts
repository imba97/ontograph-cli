import type { OntologyStore } from '../store'
import type { UserRelationSchema } from '../types'
import fs from 'node:fs'
import path from 'node:path'
import { consola } from 'consola'
import yaml from 'yaml'
import { ALL_RELATION_TYPES, relationTypes } from '../schema'
import { knownTypes } from '../validator'

const USER_RELATION_DIR = 'user-relations'

function getRelationDir(dataDir: string): string {
  return path.join(dataDir, USER_RELATION_DIR)
}

function getRelationPath(dataDir: string, rel: string): string {
  return path.join(getRelationDir(dataDir), `${rel}.yaml`)
}

function loadUserRelationSchemas(dataDir: string): Record<string, UserRelationSchema> {
  const dir = getRelationDir(dataDir)
  if (!fs.existsSync(dir))
    return {}

  const schemas: Record<string, UserRelationSchema> = {}
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.yaml'))
      continue
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8')
      const schema = yaml.parse(raw) as UserRelationSchema
      const rel = file.replace(/\.yaml$/, '')
      schemas[rel] = schema
    }
    catch {
      // Skip malformed files
    }
  }
  return schemas
}

export function relationTypeList(store: OntologyStore): void {
  const dataDir = store.getDataDir()
  const userSchemas = loadUserRelationSchemas(dataDir)

  const allRels = [
    ...ALL_RELATION_TYPES.map(r => ({ name: r, source: 'preset' as const })),
    ...Object.keys(userSchemas).map(r => ({ name: r, source: 'user' as const }))
  ]

  consola.info('Relation types:')
  for (const { name, source } of allRels.sort((a, b) => a.name.localeCompare(b.name))) {
    const schema = userSchemas[name]
    const def = relationTypes[name]
    const label = schema?.name || def?.description || name
    consola.log(`  ${source === 'user' ? '👤' : '⚙️'} ${name}${schema || def ? ` — ${label}` : ''}`)
  }
}

export function relationTypeView(store: OntologyStore, relName: string): void {
  const dataDir = store.getDataDir()
  const userSchemas = loadUserRelationSchemas(dataDir)

  const isPreset = ALL_RELATION_TYPES.includes(relName)

  if (isPreset) {
    const def = relationTypes[relName]
    consola.info(`⚙️  ${relName} (preset)`)
    consola.log(`  Description: ${def.description}`)
    consola.log(`  From: ${def.fromTypes.join(', ')}`)
    consola.log(`  To: ${def.toTypes.join(', ')}`)
    return
  }

  const schema = userSchemas[relName]
  if (!schema) {
    consola.warn(`Unknown relation type: ${relName}`)
    return
  }

  consola.info(`👤 ${relName}`)
  if (schema.name)
    consola.log(`  Name: ${schema.name}`)
  if (schema.description)
    consola.log(`  Description: ${schema.description}`)
  consola.log(`  From: ${schema.fromTypes.join(', ')}`)
  consola.log(`  To: ${schema.toTypes.join(', ')}`)
}

export function relationTypeAdd(
  store: OntologyStore,
  relName: string,
  name: string,
  description: string,
  fromTypes: string[],
  toTypes: string[]
): void {
  const dataDir = store.getDataDir()

  // Check if relation already exists (preset)
  if (ALL_RELATION_TYPES.includes(relName)) {
    throw new Error(`Relation type "${relName}" is a preset and cannot be modified`)
  }

  const schemaPath = getRelationPath(dataDir, relName)
  if (fs.existsSync(schemaPath)) {
    throw new Error(`Relation type "${relName}" already exists`)
  }

  const schema = buildRelationSchema(dataDir, name, description, fromTypes, toTypes)

  const dir = getRelationDir(dataDir)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(schemaPath, yaml.stringify(schema), 'utf8')

  consola.success(`Added relation type: ${relName}`)
}

export function relationTypeUpdate(
  store: OntologyStore,
  relName: string,
  name: string | undefined,
  description: string | undefined,
  fromTypes?: string[],
  toTypes?: string[]
): void {
  const dataDir = store.getDataDir()

  if (ALL_RELATION_TYPES.includes(relName))
    throw new Error(`Relation type "${relName}" is a preset and cannot be modified`)

  const schemaPath = getRelationPath(dataDir, relName)
  if (!fs.existsSync(schemaPath))
    throw new Error(`Relation type "${relName}" not found`)

  const raw = fs.readFileSync(schemaPath, 'utf8')
  const existing = yaml.parse(raw) as UserRelationSchema
  const schema = buildRelationSchema(
    dataDir,
    name ?? existing.name ?? relName,
    description ?? existing.description ?? '',
    fromTypes ?? existing.fromTypes,
    toTypes ?? existing.toTypes
  )

  fs.writeFileSync(schemaPath, yaml.stringify(schema), 'utf8')
  consola.success(`Updated relation type: ${relName}`)
}

export function relationTypeRemove(store: OntologyStore, relName: string): void {
  const dataDir = store.getDataDir()

  if (ALL_RELATION_TYPES.includes(relName)) {
    throw new Error(`Cannot remove preset relation type: ${relName}`)
  }

  const schemaPath = getRelationPath(dataDir, relName)
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Relation type "${relName}" not found`)
  }

  // Check if any relations use this type
  const graph = store.getGraph()
  const usageCount = graph.relations.filter(r => r.rel === relName).length
  if (usageCount > 0) {
    throw new Error(`Cannot remove relation type "${relName}": ${usageCount} relation(s) still use it`)
  }

  fs.unlinkSync(schemaPath)
  consola.success(`Removed relation type: ${relName}`)
}

// Helper for validation
function loadUserEntitySchemas(dataDir: string): string[] {
  const dir = path.join(dataDir, 'user-entities')
  if (!fs.existsSync(dir))
    return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace(/\.yaml$/, ''))
}

function buildRelationSchema(
  dataDir: string,
  name: string,
  description: string,
  fromTypes: string[],
  toTypes: string[]
): UserRelationSchema {
  const allTypes = [...knownTypes, ...loadUserEntitySchemas(dataDir)]

  for (const t of fromTypes) {
    if (!allTypes.includes(t))
      throw new Error(`Unknown entity type in fromTypes: "${t}". Known: ${allTypes.join(', ')}`)
  }
  for (const t of toTypes) {
    if (!allTypes.includes(t))
      throw new Error(`Unknown entity type in toTypes: "${t}". Known: ${allTypes.join(', ')}`)
  }

  return {
    name,
    description: description || undefined,
    fromTypes,
    toTypes
  }
}
