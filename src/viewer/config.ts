import fs from 'node:fs'
import path from 'node:path'
import yaml from 'yaml'
import { z } from 'zod'

const fieldName = z.string().min(1)
const componentType = z.enum([
  'workflow-summary',
  'goal-list',
  'child-progress',
  'property-list',
  'stage-timeline',
  'activity-history',
  'relation-list'
])

const viewerConfigSchema = z.object({
  version: z.literal(1),
  viewer: z.object({
    title: z.string().min(1).default('Ontograph'),
    defaultNodeMode: z.enum(['card', 'dot']).default('card')
  }).default({ title: 'Ontograph', defaultNodeMode: 'card' }),
  entities: z.record(z.string(), z.object({
    label: z.string().min(1).optional(),
    color: z.string().regex(/^#[\da-f]{6}$/i).optional(),
    icon: z.enum(['circle-check', 'book-open', 'user', 'folder-tree', 'tag']).optional(),
    defaultVisible: z.boolean().default(true),
    card: z.object({
      subtitle: z.object({
        field: fieldName,
        prefix: z.string().optional(),
        truncate: z.number().int().positive().optional()
      }).optional()
    }).optional()
  })).default({}),
  relations: z.record(z.string(), z.object({
    label: z.string().min(1).optional(),
    color: z.string().regex(/^#[\da-f]{6}$/i).optional(),
    style: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
    directed: z.boolean().default(true),
    defaultVisible: z.boolean().default(true)
  })).default({}),
  workflows: z.record(z.string(), z.object({
    entityTypes: z.array(z.string().min(1)).min(1),
    fields: z.object({
      status: fieldName,
      stage: fieldName.optional(),
      goals: fieldName.optional(),
      history: fieldName.optional(),
      milestones: fieldName.optional(),
      completedAt: fieldName.optional()
    }),
    hierarchy: z.object({
      relation: z.string().min(1),
      direction: z.enum(['child-to-parent', 'parent-to-child']).default('child-to-parent')
    }).optional(),
    statuses: z.record(z.string(), z.object({
      label: z.string().min(1),
      color: z.string().regex(/^#[\da-f]{6}$/i),
      completed: z.boolean(),
      defaultVisible: z.boolean().default(true)
    })).default({})
  })).default({}),
  drawer: z.object({
    tabs: z.array(z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      when: z.enum(['always', 'workflow']).default('always'),
      components: z.array(z.object({
        type: componentType,
        direction: z.enum(['incoming', 'outgoing', 'both']).optional(),
        fields: z.array(fieldName).optional()
      })).min(1)
    })).min(1)
  }).default({
    tabs: [
      { id: 'overview', label: 'Overview', when: 'always', components: [{ type: 'property-list' }] },
      { id: 'relations', label: 'Relations', when: 'always', components: [{ type: 'relation-list', direction: 'both' }] }
    ]
  })
})

export type ViewerConfig = z.infer<typeof viewerConfigSchema>
export type ViewerWorkflowConfig = ViewerConfig['workflows'][string]
export const DEFAULT_VIEWER_CONFIG: ViewerConfig = viewerConfigSchema.parse({ version: 1 })

export function loadViewerConfig(dataDir: string, explicitPath?: string): ViewerConfig {
  const configPath = explicitPath ? path.resolve(explicitPath) : path.join(path.resolve(dataDir), 'viewer.yaml')
  if (!fs.existsSync(configPath))
    return DEFAULT_VIEWER_CONFIG
  if (!fs.statSync(configPath).isFile())
    throw new Error(`Viewer config is not a file: ${configPath}`)

  try {
    return viewerConfigSchema.parse(yaml.parse(fs.readFileSync(configPath, 'utf8')))
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.issues.map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`).join('; ')
      throw new Error(`Invalid viewer config ${configPath}: ${details}`)
    }
    throw new Error(`Cannot read viewer config: ${configPath}`, { cause: error })
  }
}

export function matchConfiguredRule<T>(rules: Record<string, T>, value: string): T | undefined {
  if (rules[value])
    return rules[value]
  for (const [pattern, rule] of Object.entries(rules)) {
    if (!pattern.includes('*'))
      continue
    const expression = new RegExp(`^${pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
    if (expression.test(value))
      return rule
  }
  return undefined
}
