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

import {describe, expect, test} from '@jest/globals'
import * as path from 'path'
import {Annotation, parseSarif} from '../src/annotations'

const FIXTURES_DIR = path.join(__dirname, 'data', 'SarifProblemTest')
const PROJECT_ROOT = path.join(FIXTURES_DIR, 'vcsRoot', 'monorepo', 'project')

function annotationsFor(fixture: string): Annotation[] {
  return parseSarif(path.join(FIXTURES_DIR, fixture), PROJECT_ROOT).annotations
}

function pathsFor(fixture: string): string[] {
  return annotationsFor(fixture).map(a => a.path)
}

describe('sarifPaths — basic reports', () => {
  test('default sarif initialization (report1)', () => {
    const annotations = annotationsFor('report1.sarif.json')
    expect(annotations.map(a => a.path)).toEqual(['Main.java'])
    expect(annotations[0].start_line).toBe(1)
    expect(annotations[0].end_line).toBe(1)
    expect(annotations[0].start_column).toBeUndefined()
    expect(annotations[0].end_column).toBeUndefined()
  })

  test('bad sarif initialization (missing uri)', () => {
    expect(pathsFor('reportBad.sarif.json')).toEqual([])
  })
})

describe('sarifPaths — absolute paths', () => {
  test('absolute paths are stripped to relative', () => {
    expect(pathsFor('reportAbsPaths.sarif.json')).toEqual([
      'Main.java',
      'src/Logic.java'
    ])
  })

  test('absolute paths and relative paths in one report resolve correctly', () => {
    expect(pathsFor('reportWithMixedPaths.sarif.json')).toEqual([
      'src/Logic.java',
      'src/Logic.java',
      'Main.java',
      'Main.java'
    ])
  })
})

describe('sarifPaths — originalUriBaseIds chain', () => {
  test('SRCROOT rooted in PROJECTROOT resolves correctly', () => {
    expect(pathsFor('reportWithOriginalUriBaseIds.sarif.json')).toEqual([
      'src/Logic.java',
      'Main.java'
    ])
  })

  test('uriBaseId names with percentage signs are treated literally', () => {
    expect(pathsFor('reportWithOriginalUriBaseIds2.sarif.json')).toEqual([
      'src/Logic.java',
      'Main.java'
    ])
  })

  test('directory URI without trailing slash gets normalized', () => {
    expect(pathsFor('reportWithOriginalUriBaseIdsNoSlash.sarif.json')).toEqual([
      'src/Logic.java',
      'Main.java'
    ])
  })

  test('absolute-style URI in originalUriBaseIds resolves correctly', () => {
    expect(
      pathsFor('reportWithOriginalUriBaseIdsAndAbsolutePaths.sarif.json')
    ).toEqual(['src/Logic.java', 'Main.java'])
  })

  test('multiple possible files: prefix discovery picks the unambiguous one', () => {
    expect(
      pathsFor(
        'reportWithOriginalUriBaseIdsAndMultiplePossibleFiles.sarif.json'
      )
    ).toEqual(['src/Logic.java', 'src/Main.java'])
  })

  test('opened project not equal to repository root (monorepo subdir)', () => {
    expect(pathsFor('reportWithParentBaseUri.sarif.json')).toEqual([
      'src/Logic.java',
      'Main.java'
    ])
  })

  test('cyclic uriBaseId references fall back to filename only', () => {
    expect(pathsFor('reportBadWithOriginalUriBaseIds.sarif.json')).toEqual([
      'Logic.java',
      'Main.java'
    ])
  })
})
