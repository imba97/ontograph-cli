# ontograph-cli

> Entity-relationship knowledge graph CLI

Add entities, relate them, and query the graph — all from the terminal.

## Install

```bash
pnpx skills add imba97/ontograph-cli -g -a your-agent
```

The skill lives at [`skills/ontograph/SKILL.md`](./skills/ontograph/SKILL.md).

## Quick Start

```bash
# Add entities
ontograph add person --name "imba97" --prop timezone=+8
ontograph add project --name "Website Redesign" --prop status=active

# Relate them
ontograph relate person_62c0841a owns project_8f2b44cd

# Query
ontograph related person_62c0841a
ontograph search imba97

# List
ontograph list
ontograph types

# Explore the relationship graph in a browser
ontograph inspect
```

## Inspector

`ontograph inspect` starts a local read-only relationship viewer and opens it in your browser. It uses a force-directed graph rather than a hierarchy, so connected entities form natural clusters without requiring a root node.

```bash
ontograph inspect [--data-dir <dir>] [--config <file>] [--port <port>] [--host <address>] [--no-open] [--focus <entity-id>]
```

The viewer supports search and type filters, card/dot node modes, pan and zoom, manual data reload, and a relationship drawer for the selected entity. It does not watch files, edit graph data, or generate an HTML artifact.

The inspector automatically loads `<data-dir>/viewer.yaml` when present. Use `--config <file>` to select another file. This single versioned YAML file maps project-specific workflow fields, status semantics, entity presentation, relation visibility, and drawer components. Without it, the inspector stays a generic entity-relationship graph and does not assume task semantics.

## Data

Stored at `~/.hermes/data/ontograph-cli` by default.

Directory layout:

```text
~/.hermes/data/ontograph-cli/
  index.yaml
  relations.yaml
  entities/
    <type>/
      <id>.yaml
```

## License

MIT
