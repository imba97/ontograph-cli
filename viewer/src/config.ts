export type ViewerComponentType = 'workflow-summary' | 'goal-list' | 'child-progress' | 'property-list' | 'stage-timeline' | 'activity-history' | 'relation-list'

export interface ViewerConfig {
  version: 1
  viewer: { title: string, defaultNodeMode: 'card' | 'dot' }
  entities: Record<string, {
    label?: string
    color?: string
    icon?: 'circle-check' | 'book-open' | 'user' | 'folder-tree' | 'tag'
    defaultVisible: boolean
    card?: { subtitle?: { field: string, prefix?: string, truncate?: number } }
  }>
  relations: Record<string, {
    label?: string
    color?: string
    style: 'solid' | 'dashed' | 'dotted'
    directed: boolean
    defaultVisible: boolean
  }>
  workflows: Record<string, {
    entityTypes: string[]
    fields: Record<string, string | undefined>
    hierarchy?: { relation: string, direction: 'child-to-parent' | 'parent-to-child' }
    statuses: Record<string, { label: string, color: string, completed: boolean, defaultVisible: boolean }>
  }>
  drawer: {
    tabs: Array<{
      id: string
      label: string
      when: 'always' | 'workflow'
      components: Array<{ type: ViewerComponentType, direction?: 'incoming' | 'outgoing' | 'both', fields?: string[] }>
    }>
  }
}

export function matchConfiguredRule<T>(rules: Record<string, T>, value: string): T | undefined {
  if (rules[value])
    return rules[value]
  for (const [pattern, rule] of Object.entries(rules)) {
    if (!pattern.includes('*'))
      continue
    const escaped = pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
    if (new RegExp(`^${escaped}$`).test(value))
      return rule
  }
  return undefined
}
