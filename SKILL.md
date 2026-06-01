---
name: ontograph-cli
description: Entity-relationship knowledge graph CLI — add entities, relate them, and query the graph. Useful for tracking people, projects, tasks and their relationships.
platforms: [linux, macos]
metadata:
  hermes:
    tags: [ontograph-cli, knowledge-graph, entity, relationship, cli]
---

# Ontograph CLI — Entity-Relationship Graph

## Overview

`ontograph` is a CLI tool for managing entities and their relations, with schema validation and graph queries.

## Core Concepts

```
[person_62c0841a] --owns--> [project_8f2b44cd]
[project_8f2b44cd] --has_task--> [task_c9d1a2ef]
```

- **Entity**: a typed object — person, project, task, event, document, etc.
- **Relation**: a directed, typed link between entities with validation.

## Supported Entity Types

| Type | Key Fields |
|------|-----------|
| `person` | name, email?, tags?, notes? |
| `project` | name, description?, status?, url?, tags? |
| `task` | title, description?, status?, priority?, due?, tags? |
| `event` | title, start, end?, location?, tags? |
| `document` | title, path?, url?, mimeType?, summary?, tags? |
| `organization` | name, type?, website?, tags? |
| `location` | name, address?, city?, country?, timezone? |

## Supported Relations

`owns`, `has_owner`, `has_task`, `part_of`, `assigned_to`, `blocked_by`, `depends_on`, `member_of`, `has_member`, `attendee_of`, `located_at`, `references`, `contributes`

## Commands

### Add Entity

```bash
ontograph add <type> [--name <name>] [--prop key=value ...]
```

### Remove Entity

```bash
ontograph remove <id>
```

### Update Entity

```bash
ontograph update <id> [--name <name>] [--prop key=value ...]
```

### Relate / Unrelate

```bash
ontograph relate <from> <rel> <to>
ontograph unrelate <from> <rel> <to>
```

### List & Search

```bash
ontograph list [type]
ontograph search <query> [--type <type>]
ontograph types
ontograph relations
```

### Query Relations

```bash
ontograph related <id> [--rel <relation>]
```

### Custom Type Management

```bash
# Entity type
ontograph entity-type list
ontograph entity-type view <name>
ontograph entity-type add <name> --name <display> --field <fieldSpec>
ontograph entity-type update <name> [--name <display>] [--desc <description>] [--field <fieldSpec>]
ontograph entity-type remove <name>

# Relation type
ontograph relation-type list
ontograph relation-type view <name>
ontograph relation-type add <name> --name <display> --from <types...> --to <types...>
ontograph relation-type update <name> [--name <display>] [--desc <description>] [--from <types...>] [--to <types...>]
ontograph relation-type remove <name>
```

Entity field spec (`<fieldSpec>`):

- Grammar: `name=<fieldName>;type=<string|number|array>[;required=<true|false>][;enum=<v1,v2,...>]`
- Required keys: `name`, `type`
- Delimiters: key-value pairs use `;`, enum list uses `,`
- Type domain: only `string`, `number`, `array` (`array` means string array)
- Default: `required=false` when omitted, and this default is not written into YAML
- Enum behavior: if `enum` exists, values must be within enum on entity add/update; if omitted, only type validation applies
- Compatibility: old colon format (`field:type:required:...`) is removed

Examples:

```bash
--field "name=name;type=string;required=true"
--field "name=model;type=array;enum=gpt-4o,claude-4"
--field "name=retry_count;type=number"
```

`update` for custom types uses force apply behavior and does not perform backward compatibility checks on existing data.

### Advanced Queries

```bash
# Aggregate counts by field
ontograph aggregate [--field <field>] [--type <type>]

# Find shortest path (BFS)
ontograph path <from> <to> [--depth <n>]

# Filter by type, status, tags
ontograph query [--type <type>] [--status <status>] [--tag <tag>...]

# Data info
ontograph info
```

## Data Storage

`~/.hermes/data/ontograph-cli`

```text
~/.hermes/data/ontograph-cli/
  index.yaml
  relations.yaml
  entities/
    <type>/
      <id>.yaml
```

## Hermes Agent Usage

```bash
# Search
ontograph search <keyword>

# Find relations
ontograph related <id>

# List all
ontograph list

# Info
ontograph info
```

## Installation

```bash
# Optional: install globally
pnpm add -g ontograph-cli

# No install required: run directly
pnpx ontograph-cli <command>
```
