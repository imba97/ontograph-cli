#!/usr/bin/env node
/**
 * Migrate ontograph data from single-file (entities.json) to split files
 * (entities/{type}/{id}.json + relations.json).
 *
 * Usage:
 *   node scripts/migrate-to-split.ts [--dry-run]
 *
 * Run from project root (where entities.json lives next to src/).
 */

import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.join(process.cwd(), 'data')
const LEGACY_FILE = path.join(DATA_DIR, 'entities.json')
const ENTITIES_DIR = path.join(DATA_DIR, 'entities')
const RELATIONS_FILE = path.join(DATA_DIR, 'relations.json')

const dryRun = process.argv.includes('--dry-run')

if (!fs.existsSync(LEGACY_FILE)) {
  console.error(`Legacy file not found: ${LEGACY_FILE}`)
  process.exit(1)
}

console.log(`Reading ${LEGACY_FILE}...`)
const raw = fs.readFileSync(LEGACY_FILE, 'utf8')
const data = JSON.parse(raw) as { entities: Record<string, unknown>; relations: unknown[] }

console.log(`Found ${Object.keys(data.entities).length} entities, ${data.relations.length} relations`)

// ── Migrate entities ─────────────────────────────────────────────────────────

for (const [id, entity] of Object.entries(data.entities)) {
  const e = entity as { type: string; [key: string]: unknown }
  const type = e.type
  if (!type) {
    console.warn(`  SKIP ${id}: no "type" field`)
    continue
  }

  const shortId = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id
  const entityDir = path.join(ENTITIES_DIR, type)
  const entityPath = path.join(entityDir, `${shortId}.json`)

  if (dryRun) {
    console.log(`  [dry-run] would write: entities/${type}/${shortId}.json`)
  }
  else {
    fs.mkdirSync(entityDir, { recursive: true })
    fs.writeFileSync(entityPath, JSON.stringify(e, null, 2), 'utf8')
    console.log(`  Wrote: entities/${type}/${shortId}.json`)
  }
}

// ── Migrate relations ───────────────────────────────────────────────────────

if (dryRun) {
  console.log(`  [dry-run] would write: relations.json`)
}
else {
  fs.writeFileSync(RELATIONS_FILE, JSON.stringify(data.relations, null, 2), 'utf8')
  console.log(`  Wrote: relations.json`)
}

// ── Rename legacy file ──────────────────────────────────────────────────────

const bakFile = `${LEGACY_FILE}.bak`
if (dryRun) {
  console.log(`  [dry-run] would rename: entities.json → entities.json.bak`)
}
else {
  fs.renameSync(LEGACY_FILE, bakFile)
  console.log(`  Renamed: entities.json → entities.json.bak`)
}

console.log('\nDone!')
if (dryRun)
  console.log('(This was a dry run. Run again without --dry-run to actually migrate.)')
