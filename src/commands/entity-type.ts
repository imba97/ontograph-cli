import type { OntologyStore } from '../store'
import type { UserEntitySchema } from '../types'
import fs from 'node:fs'
import path from 'node:path'
import { consola } from 'consola'
import yaml from 'yaml'
import { knownTypes } from '../validator'

const USER_ENTITY_DIR = 'user-entities'

function getEntityDir(dataDir: string): string {
  return path.join(dataDir, USER_ENTITY_DIR)
}

function getEntityPath(dataDir: string, type: string): string {
  return path.join(getEntityDir(dataDir), `${type}.yaml`)
}

function loadUserEntitySchemas(dataDir: string): Record<string, UserEntitySchema> {
  const dir = getEntityDir(dataDir)
  if (!fs.existsSync(dir))
    return {}

  const schemas: Record<string, UserEntitySchema> = {}
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.yaml'))
      continue
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8')
      const schema = yaml.parse(raw) as UserEntitySchema
      const type = file.replace(/\.yaml$/, '')
      schemas[type] = schema
    }
    catch {
      // Skip malformed files
    }
  }
  return schemas
}

export function entityTypeList(store: OntologyStore): void {
  const dataDir = store.getDataDir()
  const userSchemas = loadUserEntitySchemas(dataDir)

  const allTypes = [
    ...knownTypes.map(t => ({ name: t, source: 'preset' as const })),
    ...Object.keys(userSchemas).map(t => ({ name: t, source: 'user' as const }))
  ]

  consola.info('Entity types:')
  for (const { name, source } of allTypes.sort((a, b) => a.name.localeCompare(b.name))) {
    const schema = userSchemas[name]
    const label = schema?.name || name
    consola.log(`  ${source === 'user' ? '👤' : '⚙️'} ${name}${schema ? ` — ${label}` : ''}`)
  }
}

export function entityTypeView(store: OntologyStore, typeName: string): void {
  const dataDir = store.getDataDir()
  const userSchemas = loadUserEntitySchemas(dataDir)

  const isPreset = knownTypes.includes(typeName)

  if (isPreset) {
    consola.info(`⚙️  ${typeName} (preset)`)
    return
  }

  const schema = userSchemas[typeName]
  if (!schema) {
    consola.warn(`Unknown entity type: ${typeName}`)
    return
  }

  consola.info(`👤 ${typeName}`)
  if (schema.name)
    consola.log(`  Name: ${schema.name}`)
  if (schema.description)
    consola.log(`  Description: ${schema.description}`)
  if (schema.fields) {
    consola.log('  Fields:')
    for (const [field, def] of Object.entries(schema.fields)) {
      const req = def.required ? ' (required)' : ''
      const enm = def.enum ? ` [${def.enum.join(', ')}]` : ''
      consola.log(`    - ${field}: ${def.type}${req}${enm}`)
    }
  }
}

export function entityTypeAdd(
  store: OntologyStore,
  typeName: string,
  name: string,
  description: string,
  fields: Array<{ key: string, type: string, required: boolean, enum?: string[] }>
): void {
  const dataDir = store.getDataDir()

  // Check if type already exists (preset)
  if (knownTypes.includes(typeName)) {
    throw new Error(`Entity type "${typeName}" is a preset type and cannot be modified`)
  }

  // Check if already exists as user type
  const schemaPath = getEntityPath(dataDir, typeName)
  if (fs.existsSync(schemaPath)) {
    throw new Error(`Entity type "${typeName}" already exists`)
  }

  const schema = buildEntitySchema(dataDir, name, description, fields)

  const dir = getEntityDir(dataDir)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(schemaPath, yaml.stringify(schema), 'utf8')

  consola.success(`Added entity type: ${typeName}`)
}

export function entityTypeUpdate(
  store: OntologyStore,
  typeName: string,
  name: string | undefined,
  description: string | undefined,
  fields?: Array<{ key: string, type: string, required: boolean, enum?: string[] }>
): void {
  const dataDir = store.getDataDir()

  if (knownTypes.includes(typeName)) {
    throw new Error(`Entity type "${typeName}" is a preset type and cannot be modified`)
  }

  const schemaPath = getEntityPath(dataDir, typeName)
  if (!fs.existsSync(schemaPath))
    throw new Error(`Entity type "${typeName}" not found`)

  const raw = fs.readFileSync(schemaPath, 'utf8')
  const existing = yaml.parse(raw) as UserEntitySchema
  const nextName = name ?? existing.name ?? typeName
  const nextDesc = description ?? existing.description ?? ''
  const nextFields = fields ?? Object.entries(existing.fields ?? {}).map(([key, def]) => ({
    key,
    type: def.type,
    required: Boolean(def.required),
    enum: def.enum
  }))

  const schema = buildEntitySchema(dataDir, nextName, nextDesc, nextFields)
  fs.writeFileSync(schemaPath, yaml.stringify(schema), 'utf8')
  consola.success(`Updated entity type: ${typeName}`)
}

export function entityTypeRemove(store: OntologyStore, typeName: string): void {
  const dataDir = store.getDataDir()

  if (knownTypes.includes(typeName)) {
    throw new Error(`Cannot remove preset entity type: ${typeName}`)
  }

  const schemaPath = getEntityPath(dataDir, typeName)
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Entity type "${typeName}" not found`)
  }

  // Check if any entities use this type
  const entities = store.listEntities(typeName)
  if (entities.length > 0) {
    throw new Error(`Cannot remove type "${typeName}": ${entities.length} entity/entities still use it`)
  }

  fs.unlinkSync(schemaPath)
  consola.success(`Removed entity type: ${typeName}`)
}

function buildEntitySchema(
  dataDir: string,
  name: string,
  description: string,
  fields: Array<{ key: string, type: string, required: boolean, enum?: string[] }>
): UserEntitySchema {
  const allTypes = [...knownTypes, ...Object.keys(loadUserEntitySchemas(dataDir))]

  const schema: UserEntitySchema = {
    name,
    description: description || undefined,
    fields: {}
  }

  for (const f of fields) {
    if (!allTypes.includes(f.key) && f.type !== 'string' && f.type !== 'number' && f.type !== 'boolean') {
      throw new Error(`Unknown type in field "${f.key}": "${f.type}". Known types: ${allTypes.join(', ')}`)
    }
    schema.fields[f.key] = {
      type: f.type as 'string' | 'number' | 'boolean',
      required: f.required,
      enum: f.enum
    }
  }

  if (!schema.fields.name)
    schema.fields.name = { type: 'string', required: true }

  return schema
}
