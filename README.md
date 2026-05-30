# ontology

> Entity-relationship knowledge graph CLI

Add entities, relate them, and query the graph — all from the terminal.

## Install

```bash
pnpm add -g ontology
```

## Quick Start

```bash
# Add entities
ontology add person imba97 --name "imba97" --prop timezone=+8
ontology add project website --name "Website Redesign" --prop status=active

# Relate them
ontology relate person:imba97 owns project:website

# Query
ontology related person:imba97
ontology search imba97

# List
ontology list
ontology types
```

## Data

Stored at `~/.hermes/data/ontology/entities.json` by default.

## License

MIT
