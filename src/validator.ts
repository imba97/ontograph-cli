import type { Entity } from './types'
import { z } from 'zod'
import {
  relationTypes,
  VALID_ORG_TYPES,
  VALID_PRIORITIES,
  VALID_STATUSES_PROJECT,
  VALID_STATUSES_TASK
} from './schema'

// ── Entity Validation Schemas ─────────────────────────────────────────────────

const baseEntitySchema = z.object({
  name: z.string().min(1, 'name is required and must be a non-empty string').max(200, 'name must be ≤200 characters'),
  tags: z.array(z.string().max(50, 'each tag must be ≤50 characters')).optional()
})

const projectSchema = baseEntitySchema.extend({
  type: z.literal('project'),
  description: z.string().optional(),
  status: z.enum(VALID_STATUSES_PROJECT as unknown as [string, ...string[]]).optional(),
  url: z.string().optional(),
  tags: z.array(z.string().max(50)).optional()
})

const taskSchema = baseEntitySchema.extend({
  type: z.literal('task'),
  description: z.string().optional(),
  status: z.enum(VALID_STATUSES_TASK as unknown as [string, ...string[]]).optional(),
  priority: z.enum(VALID_PRIORITIES as unknown as [string, ...string[]]).optional(),
  due: z.string().optional(),
  tags: z.array(z.string().max(50)).optional()
})

const personSchema = baseEntitySchema.extend({
  type: z.literal('person'),
  email: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string().max(50)).optional()
})

const eventSchema = baseEntitySchema.extend({
  type: z.literal('event'),
  description: z.string().optional(),
  start: z.string(),
  end: z.string().optional(),
  location: z.string().optional(),
  tags: z.array(z.string().max(50)).optional()
})

const documentSchema = baseEntitySchema.extend({
  type: z.literal('document'),
  path: z.string().optional(),
  url: z.string().optional(),
  mimeType: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string().max(50)).optional()
})

const organizationSchema = baseEntitySchema.extend({
  type: z.literal('organization'),
  orgType: z.enum(VALID_ORG_TYPES as unknown as [string, ...string[]]).optional(),
  website: z.string().optional(),
  tags: z.array(z.string().max(50)).optional()
})

const locationSchema = baseEntitySchema.extend({
  type: z.literal('location'),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional()
})

const entitySchemas: Record<string, z.ZodType<Record<string, unknown>>> = {
  project: projectSchema,
  task: taskSchema,
  person: personSchema,
  event: eventSchema,
  document: documentSchema,
  organization: organizationSchema,
  location: locationSchema
}

// ── Validation Error Types ────────────────────────────────────────────────────

export interface ValidationError {
  field: string
  message: string
}

export interface RelationValidationError {
  code: 'ENTITY_NOT_FOUND' | 'INVALID_RELATION' | 'INVALID_TYPE_PAIR' | 'SELF_LOOP'
  message: string
}

// ── Entity Validation ─────────────────────────────────────────────────────────

export function validateEntity(type: string, data: Partial<Entity>): ValidationError[] {
  const schema = entitySchemas[type]

  // Unknown type — skip schema validation, just check name presence manually
  if (!schema) {
    const errors: ValidationError[] = []
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'name is required and must be a non-empty string' })
    }
    if (data.name && data.name.length > 200) {
      errors.push({ field: 'name', message: 'name must be ≤200 characters' })
    }
    if (data.tags && !Array.isArray(data.tags)) {
      errors.push({ field: 'tags', message: 'tags must be an array' })
    }
    return errors
  }

  const result = schema.safeParse(data)

  if (!result.success) {
    return result.error.issues.map(issue => ({
      field: issue.path.join('.') || 'unknown',
      message: issue.message
    }))
  }

  return []
}

// ── Relation Validation ──────────────────────────────────────────────────────

export function validateRelation(
  fromId: string,
  toId: string,
  rel: string,
  graph: { entities: Record<string, Entity>, relations: { from: string, rel: string, to: string }[] }
): RelationValidationError | null {
  if (fromId === toId) {
    return { code: 'SELF_LOOP', message: `Cannot create self-referencing relation: ${fromId}` }
  }

  if (!graph.entities[fromId]) {
    return { code: 'ENTITY_NOT_FOUND', message: `Source entity "${fromId}" not found` }
  }
  if (!graph.entities[toId]) {
    return { code: 'ENTITY_NOT_FOUND', message: `Target entity "${toId}" not found` }
  }

  if (!(rel in relationTypes)) {
    return {
      code: 'INVALID_RELATION',
      message: `Unknown relation type "${rel}". Known: ${Object.keys(relationTypes).join(', ')}`
    }
  }

  const def = relationTypes[rel]
  const fromType = graph.entities[fromId].type
  const toType = graph.entities[toId].type

  if (!def.fromTypes.includes(fromType)) {
    return {
      code: 'INVALID_TYPE_PAIR',
      message: `"${fromType}" cannot use relation "${rel}" (allowed: ${def.fromTypes.join(', ')})`
    }
  }
  if (!def.toTypes.includes(toType)) {
    return {
      code: 'INVALID_TYPE_PAIR',
      message: `"${toType}" cannot be the target of "${rel}" (allowed: ${def.toTypes.join(', ')})`
    }
  }

  return null
}

export const knownTypes = ['person', 'project', 'task', 'event', 'document', 'organization', 'location']
