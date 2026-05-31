---
name: ontograph-cli
description: Entity-relationship knowledge graph CLI — add entities, relate them, and query the graph. Useful for tracking people, projects, tasks and their relationships.
version: 0.2.0
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
[person:imba97] --owns--> [project:blog]
[project:blog] --has_task--> [task:rewrite]
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
ontograph add <type> <id> --name <name> [--prop key=value ...]
```

### Remove Entity

```bash
ontograph remove <id>
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
pnpm add -g ontograph-cli
```
