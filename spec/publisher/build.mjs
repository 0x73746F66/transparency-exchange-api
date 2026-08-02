#!/usr/bin/env node
// Build spec/publisher/openapi.yaml from the consumption specification plus a
// publication overlay.
//
// The publisher document used to be a hand-maintained copy of the consumption
// spec. It drifted, as copies do: while the consumption API reached 0.4.0 the
// copy was still carrying schemas from 0.0.3, under different names:
// `artifactFormat` beside the real `artifact-format`, `typeUuid` beside `uuid`,
// a private `artifactChecksum` beside `checksum`. A combined document then has
// two definitions of the same concept, each free to move independently, and
// nothing in it says which one a publisher should believe.
//
// Generating the document removes the possibility. Everything shared is a
// `$ref` into the consumption spec's own definitions, so there is exactly one
// definition of a product, a checksum or an artifact format, and the publisher
// version is the consumer version by construction.
//
//   node spec/publisher/build.mjs           # regenerate openapi.yaml
//   node spec/publisher/build.mjs --check   # fail (exit 1) if it has drifted
//
// Run --check in CI after any change to spec/openapi.yaml.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const here = dirname(fileURLToPath(import.meta.url))
const consumerPath = resolve(here, '..', 'openapi.yaml')
const overlayPath = resolve(here, 'overlay.yaml')
const outPath = resolve(here, 'openapi.yaml')

const consumer = yaml.load(readFileSync(consumerPath, 'utf8'))
const overlay = yaml.load(readFileSync(overlayPath, 'utf8'))

/**
 * Merge the overlay onto the consumption document.
 *
 * Deliberately shallow-but-structured rather than a generic deep merge: the
 * overlay may only ADD. If it defines a key the consumption spec already
 * defines, that is drift reappearing, the publisher redefining something the
 * consumer owns, so it is a build failure rather than a silent overwrite.
 */
const collisions = []

// The consumption document's global `security` now offers an anonymous
// alternative, because every operation in it is a read and discovery has no
// step at which a credential could be obtained.
//
// That must not reach the publication operations. Inheriting the global list
// would make anonymous writes conformant, which is the opposite of what the
// access policy exists to say, so every operation the overlay contributes
// declares its own requirement here. Stated once, rather than repeated on
// twenty operations where one omission would be a silent hole.
const WRITE_SECURITY = [{ bearerAuth: [] }, { basicAuth: [] }]

// A path item also holds `parameters`, `summary` and `$ref`, none of which take
// a security requirement.
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])

function requireCredential(method, op) {
    // An overlay operation may still set `security` itself; this only supplies
    // the default.
    if (HTTP_METHODS.has(method)) op.security ??= WRITE_SECURITY
    return op
}

function mergeSection(target, source, path) {
    for (const [key, value] of Object.entries(source ?? {})) {
        if (target[key] === undefined) {
            if (path === 'paths') {
                for (const [method, op] of Object.entries(value)) requireCredential(method, op)
            }
            target[key] = value
            continue
        }
        // Path items are the one place both documents legitimately contribute:
        // the consumer defines GET /product/{uuid}, the publisher adds PATCH
        // and DELETE to the same path. Merge per method, and still refuse to
        // redefine a method the consumer already declared.
        if (path === 'paths') {
            for (const [method, op] of Object.entries(value)) {
                if (target[key][method] !== undefined) {
                    collisions.push(`${path}.${key}.${method}`)
                    continue
                }
                target[key][method] = requireCredential(method, op)
            }
            continue
        }
        collisions.push(`${path}.${key}`)
    }
}

// info: the publisher document describes the same API version as the consumer.
// The version is copied, never chosen, so the two cannot report different
// numbers for the same object model.
consumer.info = {
    ...consumer.info,
    title: 'Transparency Exchange API',
    summary: 'The OWASP Transparency Exchange API specification for consumers and publishers',
    description: [
        consumer.info.description?.trim(),
        '',
        'This document is the consumption specification plus the publication',
        'operations. Everything the two share, whether products, components,',
        'releases, collections, artifacts, checksums or identifiers, has a single',
        'definition,',
        'taken from the consumption specification, so a publisher and a consumer',
        'cannot hold different ideas of the same object.',
        '',
        'Generated by spec/publisher/build.mjs. Do not edit by hand: edit',
        'spec/publisher/overlay.yaml, or the consumption specification, and rebuild.',
    ].filter(v => v !== undefined).join('\n'),
}

mergeSection(consumer.paths, overlay.paths, 'paths')

for (const section of ['schemas', 'parameters', 'responses', 'requestBodies', 'securitySchemes']) {
    consumer.components[section] ??= {}
    mergeSection(consumer.components[section], overlay.components?.[section], `components.${section}`)
}

// Tags are a list, not a map.
const existingTags = new Set((consumer.tags ?? []).map(t => t.name))
consumer.tags = [
    ...(consumer.tags ?? []),
    ...(overlay.tags ?? []).filter(t => !existingTags.has(t.name)),
]

if (collisions.length) {
    console.error('The overlay redefines objects the consumption specification already owns:')
    for (const c of collisions) console.error(`  ${c}`)
    console.error('\nRemove them from the overlay and $ref the consumption definition instead.')
    process.exit(1)
}

const banner = `# GENERATED FILE - do not edit by hand.
#
# Built by spec/publisher/build.mjs from:
#   spec/openapi.yaml           (the consumption specification, version ${consumer.info.version})
#   spec/publisher/overlay.yaml (the publication operations)
#
# Regenerate with: node spec/publisher/build.mjs
`

const body = yaml.dump(consumer, {
    lineWidth: 100,
    noRefs: true,
    quotingType: '"',
})

const out = `${banner}\n${body}`

if (process.argv.includes('--check')) {
    let current = ''
    try {
        current = readFileSync(outPath, 'utf8')
    } catch {
        current = ''
    }
    if (current !== out) {
        console.error('spec/publisher/openapi.yaml has drifted from the consumption specification.')
        console.error('Run: node spec/publisher/build.mjs')
        process.exit(1)
    }
    console.log(`publisher spec is in sync with consumption specification ${consumer.info.version}.`)
    process.exit(0)
}

writeFileSync(outPath, out)
console.log(
    `Wrote ${outPath}\n`
    + `  version ${consumer.info.version}, `
    + `${Object.keys(consumer.paths).length} paths, `
    + `${Object.keys(consumer.components.schemas).length} schemas.`,
)
