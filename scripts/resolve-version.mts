#!/usr/bin/env node
/**
 * Resolve a dependency's pinned version from the root `package.json`.
 *
 * Usage:
 *   node scripts/resolve-version.mts <package-name>
 *   # e.g. node scripts/resolve-version.mts turbo  ->  2.9.12
 *
 * The version range in `package.json` may be `^x.y.z`, `~x.y.z`, `x.y.z`,
 * `>=x.y.z`, an exact `x.y.z`, etc. We DO NOT string-replace range
 * operators — we extract the semver substring using the official SemVer 2.0.0
 * regex from https://semver.org (`^$` anchors removed so it matches a
 * semver embedded inside a range string).
 *
 * Node.js 22.6+ strips type annotations from `.mts` files natively; the
 * project targets Node 24, so no transpile step is required.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Official SemVer 2.0.0 regex (per semver.org), anchors removed so it
// extracts the semver substring from inside a range like "^2.9.12".
// Source: https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
const SEMVER =
  /(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?/

interface PackageJson {
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
}

const [, , depName] = process.argv
if (!depName) {
  process.stderr.write('usage: resolve-version.mts <package-name>\n')
  process.exit(2)
}

const here = dirname(fileURLToPath(import.meta.url))
const pkgPath = resolve(here, '..', 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJson

const range: string | undefined =
  pkg.devDependencies?.[depName] ??
  pkg.dependencies?.[depName] ??
  pkg.peerDependencies?.[depName] ??
  pkg.optionalDependencies?.[depName]

if (!range) {
  process.stderr.write(`No version range for "${depName}" in ${pkgPath}\n`)
  process.exit(1)
}

const match = SEMVER.exec(range)
if (!match) {
  process.stderr.write(`Cannot extract semver from "${depName}@${range}"\n`)
  process.exit(1)
}

process.stdout.write(match[0])
