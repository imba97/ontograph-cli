---
name: ontology
description: Entity-relationship knowledge graph CLI — add entities, relate them, and query the graph. Useful for tracking people, projects, tasks and their relationships.
version: 0.2.0
platforms: [linux, macos]
metadata:
  hermes:
    tags: [ontology, knowledge-graph, entity, relationship, cli]
---

# Ontology — Entity-Relationship Graph

## Overview

`ontology` is a CLI tool for managing entities and their relations, with schema validation and graph queries.

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
ontology add <type> <id> --name <name> [--prop key=value ...]
```

### Remove Entity

```bash
ontology remove <id>
```

### Relate / Unrelate

```bash
ontology relate <from> <rel> <to>
ontology unrelate <from> <rel> <to>
```

### List & Search

```bash
ontology list [type]
ontology search <query> [--type <type>]
ontology types
ontology relations
```

### Query Relations

```bash
ontology related <id> [--rel <relation>]
```

### Advanced Queries

```bash
# Aggregate counts by field
ontology aggregate [--field <field>] [--type <type>]

# Find shortest path (BFS)
ontology path <from> <to> [--depth <n>]

# Filter by type, status, tags
ontology query [--type <type>] [--status <status>] [--tag <tag>...]

# Data info
ontology info
```

## Data Storage

`~/.hermes/data/ontology/entities.json`

## Hermes Agent Usage

```bash
# Search
ontology search <keyword>

# Find relations
ontology related <id>

# List all
ontology list

# Info
ontology info
```

## Installation

```bash
pnpm add -g ontology
```
