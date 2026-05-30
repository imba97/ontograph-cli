// ── Relation Definitions ─────────────────────────────────────────────────────

export interface RelationTypeDef {
  fromTypes: string[]
  toTypes: string[]
  description: string
}

export const relationTypes: Record<string, RelationTypeDef> = {
  owns: {
    fromTypes: ['person', 'organization'],
    toTypes: ['project', 'document', 'account', 'device'],
    description: 'Ownership relation'
  },
  has_owner: {
    fromTypes: ['project', 'task', 'document'],
    toTypes: ['person'],
    description: 'Entity is owned by a person'
  },
  has_task: {
    fromTypes: ['project'],
    toTypes: ['task'],
    description: 'Project contains a task'
  },
  part_of: {
    fromTypes: ['task', 'document', 'event'],
    toTypes: ['project'],
    description: 'Belongs to a project'
  },
  assigned_to: {
    fromTypes: ['task'],
    toTypes: ['person'],
    description: 'Task assigned to a person'
  },
  blocked_by: {
    fromTypes: ['task'],
    toTypes: ['task'],
    description: 'Task is blocked by another task'
  },
  depends_on: {
    fromTypes: ['task', 'project'],
    toTypes: ['task', 'project', 'event'],
    description: 'Depends on another entity'
  },
  member_of: {
    fromTypes: ['person'],
    toTypes: ['organization'],
    description: 'Member of an organization'
  },
  has_member: {
    fromTypes: ['organization'],
    toTypes: ['person'],
    description: 'Organization has a member'
  },
  attendee_of: {
    fromTypes: ['person'],
    toTypes: ['event'],
    description: 'Attending an event'
  },
  located_at: {
    fromTypes: ['event', 'person', 'device'],
    toTypes: ['location'],
    description: 'Located at a place'
  },
  references: {
    fromTypes: ['document', 'note'],
    toTypes: ['document', 'note'],
    description: 'References another document'
  },
  contributes: {
    fromTypes: ['person'],
    toTypes: ['project'],
    description: 'Contributes to a project'
  }
}

export const ALL_RELATION_TYPES = Object.keys(relationTypes)
export const VALID_STATUSES_PROJECT = ['planning', 'active', 'paused', 'completed', 'archived'] as const
export const VALID_STATUSES_TASK = ['open', 'in_progress', 'blocked', 'done', 'cancelled'] as const
export const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export const VALID_ORG_TYPES = ['company', 'team', 'community', 'government', 'other'] as const
