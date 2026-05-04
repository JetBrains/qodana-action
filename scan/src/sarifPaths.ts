/*
 * Copyright 2021-2026 JetBrains s.r.o.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as fs from 'fs'
import path from 'path'
import type {ArtifactLocation, Location, Result} from 'sarif'

export type OriginalUriBaseIds = Record<string, ArtifactLocation>

export interface PrefixesToRemove {
  absolutePrefix: string
  relativePrefix: string
}

export const EMPTY_PREFIXES: PrefixesToRemove = {
  absolutePrefix: '',
  relativePrefix: ''
}

class CyclicUriBaseIdError extends Error {}

function resolveUriBaseIdImpl(
  originalUriBaseIds: OriginalUriBaseIds,
  uriBaseId: string,
  visited: string[]
): string {
  if (visited.includes(uriBaseId)) {
    visited.push(uriBaseId)
    throw new CyclicUriBaseIdError(
      `Cyclic uriBaseId resolution: ${visited.join(', ')}`
    )
  }
  visited.push(uriBaseId)

  const artifactLocation = originalUriBaseIds[uriBaseId]
  if (artifactLocation === undefined) return ''

  const uri = artifactLocation.uri ?? ''
  const parentUriBaseId = artifactLocation.uriBaseId

  const resolved =
    parentUriBaseId !== undefined
      ? resolveUriBaseIdImpl(originalUriBaseIds, parentUriBaseId, visited) + uri
      : uri

  // RFC 3986: directory URIs may omit the trailing separator; normalize so
  // concatenation with a relative file URI never collides path segments.
  if (resolved === '' || resolved.endsWith('/')) return resolved
  return `${resolved}/`
}

export function resolveUriBaseId(
  originalUriBaseIds: OriginalUriBaseIds,
  uriBaseId: string
): string {
  try {
    return resolveUriBaseIdImpl(originalUriBaseIds, uriBaseId, [])
  } catch (e) {
    if (e instanceof CyclicUriBaseIdError) return ''
    throw e
  }
}

function locationUriAndBaseId(
  location: Location
): {uri: string; uriBaseId: string | undefined} | null {
  const artifactLocation = location.physicalLocation?.artifactLocation
  const uri = artifactLocation?.uri
  if (uri === undefined) return null
  return {uri, uriBaseId: artifactLocation?.uriBaseId}
}

function resolvedUri(
  location: Location,
  originalUriBaseIds: OriginalUriBaseIds
): string | null {
  const parts = locationUriAndBaseId(location)
  if (parts === null) return null
  const {uri, uriBaseId} = parts
  return uriBaseId !== undefined
    ? resolveUriBaseId(originalUriBaseIds, uriBaseId) + uri
    : uri
}

function removePrefix(s: string, prefix: string): string {
  return s.startsWith(prefix) ? s.slice(prefix.length) : s
}

export function getLocationWithoutPrefix(
  location: Location,
  originalUriBaseIds: OriginalUriBaseIds,
  prefixes: PrefixesToRemove
): string | null {
  const resolved = resolvedUri(location, originalUriBaseIds)
  if (resolved === null) return null
  return path.isAbsolute(resolved)
    ? removePrefix(resolved, prefixes.absolutePrefix)
    : removePrefix(resolved, prefixes.relativePrefix)
}

function intersect<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>()
  for (const x of a) if (b.has(x)) out.add(x)
  return out
}

function countSlashes(s: string): number {
  let n = 0
  for (const ch of s) if (ch === '/') n++
  return n
}

function fileExistsRelative(
  projectRoot: string,
  relativePath: string
): boolean {
  try {
    return fs.existsSync(path.join(projectRoot, relativePath))
  } catch {
    return false
  }
}

/**
 * Find a single common prefix that, when removed from each given path, lets
 * the path resolve under {@link projectRoot}. Returns `''` when no such single
 * prefix exists — matching the Kotlin implementation, which prefers a
 * conservative no-op over a guess.
 */
export function findPrefixToRemove(
  files: Set<string>,
  projectRoot: string,
  checkFilesCount = 3
): string {
  // Take the longest paths for robustness; deeper paths are less ambiguous.
  const sorted = [...files].sort((a, b) => countSlashes(b) - countSlashes(a))

  let commonPrefixes: Set<string> | null = null

  for (const filePath of sorted.slice(0, checkFilesCount)) {
    const filePrefixes = new Set<string>()
    let prefix = ''

    for (const part of filePath.split('/')) {
      if (fileExistsRelative(projectRoot, removePrefix(filePath, prefix))) {
        filePrefixes.add(prefix)
      }
      prefix += `${part}/`
    }

    commonPrefixes =
      commonPrefixes === null
        ? filePrefixes
        : intersect(commonPrefixes, filePrefixes)
    if (commonPrefixes.size === 0) return ''
  }

  if (commonPrefixes !== null && commonPrefixes.size === 1) {
    return [...commonPrefixes][0]
  }
  return ''
}

export function getPrefixesToRemove(
  results: Result[],
  originalUriBaseIds: OriginalUriBaseIds | undefined,
  projectRoot: string
): PrefixesToRemove {
  if (!projectRoot) return EMPTY_PREFIXES

  const baseIds = originalUriBaseIds ?? {}
  const paths: string[] = []
  for (const result of results) {
    const locations = result.locations ?? []
    for (const loc of locations) {
      const uri = resolvedUri(loc, baseIds)
      if (uri !== null) paths.push(uri)
    }
  }

  const absolutePaths = new Set(paths.filter(p => path.isAbsolute(p)))
  const relativePaths = new Set(paths.filter(p => !path.isAbsolute(p)))

  return {
    absolutePrefix: findPrefixToRemove(absolutePaths, projectRoot),
    relativePrefix: findPrefixToRemove(relativePaths, projectRoot)
  }
}
