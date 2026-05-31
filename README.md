# ontograph-cli

> Entity-relationship knowledge graph CLI

Add entities, relate them, and query the graph — all from the terminal.

## Install

```bash
pnpx skills add imba97/ontograph-cli -g -a your-agent
```

## Quick Start

```bash
# Add entities
ontograph add person imba97 --name "imba97" --prop timezone=+8
ontograph add project website --name "Website Redesign" --prop status=active

# Relate them
ontograph relate person:imba97 owns project:website

# Query
ontograph related person:imba97
ontograph search imba97

# List
ontograph list
ontograph types
```

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
