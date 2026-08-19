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

import {describe, expect, test} from '@jest/globals'
import type {Location} from 'sarif'
import {parseSarif} from '../src/annotations'
import {
  OriginalUriBaseIds,
  resolveLocationUri,
  resolveUriBaseId
} from '../src/sarifPaths'

function location(uri: string, uriBaseId?: string): Location {
  return {
    physicalLocation: {
      artifactLocation: {uri, uriBaseId}
    }
  }
}

describe('originalUriBaseIds', () => {
  test('falls back to the artifact URI for a missing base', () => {
    expect(resolveLocationUri(location('Missing.kt', 'UNKNOWN'), {})).toBe(
      'Missing.kt'
    )
  })

  test('resolves locations relative to chained base IDs', () => {
    const baseIds: OriginalUriBaseIds = {
      PROJECTROOT: {
        description: {
          text: 'The root directory of the repository or workspace (--repository-root qodana CLI parameter)'
        }
      },
      SRCROOT: {
        uri: 'src/',
        uriBaseId: 'PROJECTROOT',
        description: {
          text: 'The subdirectory within the project that was analyzed (--project-dir qodana CLI parameter)'
        }
      }
    }

    expect(resolveLocationUri(location('Logic.java', 'SRCROOT'), baseIds)).toBe(
      'src/Logic.java'
    )
    expect(
      resolveLocationUri(location('Main.java', 'PROJECTROOT'), baseIds)
    ).toBe('Main.java')
  })

  test('treats base ID names literally, including percentage signs', () => {
    const baseIds: OriginalUriBaseIds = {
      '%PROJECTROOT%': {
        description: {
          text: 'The root directory of the repository or workspace (--repository-root qodana CLI parameter)'
        }
      },
      '%SRCROOT%': {
        uri: 'src/',
        uriBaseId: '%PROJECTROOT%',
        description: {
          text: 'The subdirectory within the project that was analyzed (--project-dir qodana CLI parameter)'
        }
      }
    }

    expect(
      resolveLocationUri(location('Logic.java', '%SRCROOT%'), baseIds)
    ).toBe('src/Logic.java')
    expect(
      resolveLocationUri(location('Main.java', '%PROJECTROOT%'), baseIds)
    ).toBe('Main.java')
  })

  test('resolves locations when the base URI is an absolute path', () => {
    const baseIds: OriginalUriBaseIds = {
      '%PROJECTROOT%': {
        uri: 'file:///some/absolute/path/in/ci/',
        description: {
          text: 'The root directory of the repository or workspace (--repository-root qodana CLI parameter)'
        }
      },
      '%SRCROOT%': {
        uri: 'src/',
        uriBaseId: '%PROJECTROOT%',
        description: {
          text: 'The subdirectory within the project that was analyzed (--project-dir qodana CLI parameter)'
        }
      }
    }

    expect(
      resolveLocationUri(location('Logic.java', '%SRCROOT%'), baseIds)
    ).toBe('file:///some/absolute/path/in/ci/src/Logic.java')
    expect(
      resolveLocationUri(location('Main.java', '%PROJECTROOT%'), baseIds)
    ).toBe('file:///some/absolute/path/in/ci/Main.java')
  })

  test('resolves a directory base URI without a trailing slash', () => {
    const baseIds: OriginalUriBaseIds = {
      PROJECTROOT: {
        description: {
          text: 'The root directory of the repository or workspace (--repository-root qodana CLI parameter)'
        }
      },
      SRCROOT: {
        uri: 'src',
        uriBaseId: 'PROJECTROOT',
        description: {
          text: 'The subdirectory within the project that was analyzed (--project-dir qodana CLI parameter)'
        }
      }
    }

    expect(resolveLocationUri(location('Logic.java', 'SRCROOT'), baseIds)).toBe(
      'src/Logic.java'
    )
    expect(
      resolveLocationUri(location('Main.java', 'PROJECTROOT'), baseIds)
    ).toBe('Main.java')
  })

  test('falls back to the artifact URI for cyclic bases', () => {
    const baseIds: OriginalUriBaseIds = {
      PROJECTROOT: {
        uri: 'project/',
        uriBaseId: 'SRCROOT',
        description: {
          text: 'The root directory of the repository or workspace (--repository-root qodana CLI parameter)'
        }
      },
      SRCROOT: {
        uri: 'src/',
        uriBaseId: 'PROJECTROOT',
        description: {
          text: 'The subdirectory within the project that was analyzed (--project-dir qodana CLI parameter)'
        }
      }
    }

    expect(resolveUriBaseId(baseIds, 'SRCROOT')).toBe('')
    expect(resolveUriBaseId(baseIds, 'PROJECTROOT')).toBe('')
    expect(resolveLocationUri(location('Logic.java', 'SRCROOT'), baseIds)).toBe(
      'Logic.java'
    )
    expect(
      resolveLocationUri(location('Main.java', 'PROJECTROOT'), baseIds)
    ).toBe('Main.java')
  })

  test('resolves locations when the analyzed project dir is a subdirectory of the repository root', () => {
    const baseIds: OriginalUriBaseIds = {
      PROJECTROOT: {
        description: {
          text: 'The root directory of the repository or workspace (--repository-root qodana CLI parameter)'
        }
      },
      SRCROOT: {
        uri: 'monorepo/project/',
        uriBaseId: 'PROJECTROOT',
        description: {
          text: 'The subdirectory within the project that was analyzed (--project-dir qodana CLI parameter)'
        }
      }
    }

    expect(
      resolveLocationUri(location('src/Logic.java', 'SRCROOT'), baseIds)
    ).toBe('monorepo/project/src/Logic.java')
    expect(resolveLocationUri(location('Main.java', 'SRCROOT'), baseIds)).toBe(
      'monorepo/project/Main.java'
    )
  })

  test('parseSarif uses resolved artifact paths for annotations', () => {
    const result = parseSarif(
      '__tests__/data/with.original-uri-base-ids.sarif.json'
    )

    expect(result.annotations.map(annotation => annotation.path)).toEqual([
      'services/widget/Widget.cs'
    ])
  })
})
