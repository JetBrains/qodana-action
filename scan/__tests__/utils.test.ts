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

import {expect} from '@jest/globals'
import {isNeedToUploadCache} from '../src/utils'
import * as github from '@actions/github'
import {ENABLE_USE_CACHE_OPTION_WARNING} from '../src/utils'

const masterBranch = 'master'
describe('isNeedToUploadCache', () => {
  it.each([
    [masterBranch, true],
    ['branch', false]
  ])(
    'for branch %s should return %s when cacheDefaultBranchOnly=true, useCache=true',
    (currentBranch, expected) => {
      initGithubContext(currentBranch)
      expect(isNeedToUploadCache(true, true)).toBe(expected)
    }
  )

  it.each([
    [true, masterBranch, true],
    [true, 'branch', true],
    [false, masterBranch, false],
    [false, 'branch', false]
  ])(
    'if cacheDefaultBranchOnly=false should return useCache, current branch is %s, useCache=%s, expected %s',
    (useCache, currentBranch, expected) => {
      initGithubContext(currentBranch)
      expect(isNeedToUploadCache(useCache, false)).toBe(expected)
    }
  )

  it.each([masterBranch, 'branch'])(
    'should return false when useCache=false and cacheDefaultBranchOnly=true, branch %s',
    branch => {
      initGithubContext(branch)
      expect(isNeedToUploadCache(false, true)).toBe(false)
    }
  )

  it('should warn when useCache=false and cacheDefaultBranchOnly=true', () => {
    const core = require('@actions/core')
    jest.spyOn(core, 'warning')
    initGithubContext(masterBranch)
    isNeedToUploadCache(false, true)
    expect(core.warning).toHaveBeenCalledWith(ENABLE_USE_CACHE_OPTION_WARNING)
  })
})

describe('getInputs cache key native mode prefix', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  function setupCoreMock(
    args: string,
    primaryKey: string,
    additionalKey: string
  ): void {
    jest.doMock('@actions/core', () => ({
      getInput: (name: string) => {
        switch (name) {
          case 'args':
            return args
          case 'primary-cache-key':
            return primaryKey
          case 'additional-cache-key':
            return additionalKey
          default:
            return ''
        }
      },
      getBooleanInput: () => false,
      warning: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      addPath: jest.fn(),
      setFailed: jest.fn()
    }))
  }

  // Matches the defaults defined in action.yaml for primary-cache-key and
  // additional-cache-key after GitHub expression interpolation.
  const PRIMARY_KEY = 'qodana-2026.1-refs/heads/main-abc'
  const ADDITIONAL_KEY = 'qodana-2026.1-refs/heads/main'

  it('prepends native-false- when args have no native flags', () => {
    setupCoreMock('', PRIMARY_KEY, ADDITIONAL_KEY)
    const {getInputs} = require('../src/utils')
    const inputs = getInputs()
    expect(inputs.primaryCacheKey).toBe(`native-false-${PRIMARY_KEY}`)
    expect(inputs.additionalCacheKey).toBe(`native-false-${ADDITIONAL_KEY}`)
    // additionalCacheKey must be a prefix of primaryCacheKey so that
    // GitHub Actions restoreKeys fallback can match.
    expect(inputs.primaryCacheKey.startsWith(inputs.additionalCacheKey)).toBe(
      true
    )
  })

  it('prepends native-true- when args contain --ide', () => {
    setupCoreMock('--ide', PRIMARY_KEY, ADDITIONAL_KEY)
    const {getInputs} = require('../src/utils')
    const inputs = getInputs()
    expect(inputs.primaryCacheKey).toBe(`native-true-${PRIMARY_KEY}`)
    expect(inputs.additionalCacheKey).toBe(`native-true-${ADDITIONAL_KEY}`)
    expect(inputs.primaryCacheKey.startsWith(inputs.additionalCacheKey)).toBe(
      true
    )
  })

  it('prepends native-true- when args contain --within-docker=false', () => {
    setupCoreMock('--within-docker=false', PRIMARY_KEY, ADDITIONAL_KEY)
    const {getInputs} = require('../src/utils')
    const inputs = getInputs()
    expect(inputs.primaryCacheKey).toBe(`native-true-${PRIMARY_KEY}`)
    expect(inputs.additionalCacheKey).toBe(`native-true-${ADDITIONAL_KEY}`)
    expect(inputs.primaryCacheKey.startsWith(inputs.additionalCacheKey)).toBe(
      true
    )
  })
})

export function initGithubContext(currentBranch: string): void {
  Object.defineProperty(github, 'context', {
    value: {
      ref: `refs/heads/${currentBranch}`,
      payload: {repository: {default_branch: masterBranch}}
    }
  })
}
