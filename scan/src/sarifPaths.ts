/*
 * Copyright 2021-2026 JetBrains s.r.o.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {ArtifactLocation, Location} from 'sarif'

export type OriginalUriBaseIds = Record<string, ArtifactLocation>

class CyclicUriBaseIdError extends Error {}

function resolveUriBaseIdImpl(
  originalUriBaseIds: OriginalUriBaseIds,
  uriBaseId: string,
  visited: string[]
): string {
  if (visited.includes(uriBaseId)) {
    throw new CyclicUriBaseIdError()
  }
  visited.push(uriBaseId)

  const artifactLocation = originalUriBaseIds[uriBaseId]
  if (artifactLocation === undefined) return ''

  const uri = artifactLocation.uri ?? ''
  const parentUriBaseId = artifactLocation.uriBaseId
  const resolved =
    parentUriBaseId === undefined
      ? uri
      : resolveUriBaseIdImpl(originalUriBaseIds, parentUriBaseId, visited) + uri

  // Directory URIs may omit the trailing separator. Normalize it before
  // appending an artifact URI, matching Qodana's SARIF report reader.
  return resolved === '' || resolved.endsWith('/') ? resolved : `${resolved}/`
}

export function resolveUriBaseId(
  originalUriBaseIds: OriginalUriBaseIds,
  uriBaseId: string
): string {
  try {
    return resolveUriBaseIdImpl(originalUriBaseIds, uriBaseId, [])
  } catch (error) {
    if (error instanceof CyclicUriBaseIdError) return ''
    throw error
  }
}

export function resolveLocationUri(
  location: Location,
  originalUriBaseIds: OriginalUriBaseIds
): string | null {
  const artifactLocation = location.physicalLocation?.artifactLocation
  if (artifactLocation === undefined || artifactLocation.uri === undefined) {
    return null
  }
  const uri = artifactLocation.uri

  return artifactLocation.uriBaseId === undefined
    ? uri
    : resolveUriBaseId(originalUriBaseIds, artifactLocation.uriBaseId) + uri
}
