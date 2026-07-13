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

describe('publishGitHubCheck — job check-run via _job-check-run-id input', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  function makeOctokit(
    overrides: {
      update?: jest.Mock
      listForRefImpl?: () => Promise<unknown>
      createImpl?: () => Promise<unknown>
    } = {}
  ): {
    update: jest.Mock
    listForRef: jest.Mock
    create: jest.Mock
    client: unknown
  } {
    const update = overrides.update ?? jest.fn(async () => ({}))
    const listForRef = jest.fn(
      overrides.listForRefImpl ?? (async () => ({data: {check_runs: []}}))
    )
    const create = jest.fn(overrides.createImpl ?? (async () => ({})))
    const client = {
      rest: {
        checks: {update, listForRef, create}
      }
    }
    return {update, listForRef, create, client}
  }

  function setupMocks(
    octokitClient: unknown,
    inputValue: string,
    coreWarning: jest.Mock = jest.fn()
  ): jest.Mock {
    jest.doMock('@actions/core', () => ({
      getInput: (name: string) => {
        if (name === 'github-token') return 'tkn'
        if (name === '_job-check-run-id') return inputValue
        return ''
      },
      getBooleanInput: () => false,
      getMultilineInput: () => [],
      warning: coreWarning,
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      notice: jest.fn(),
      addPath: jest.fn(),
      setFailed: jest.fn(),
      setOutput: jest.fn(),
      summary: {addRaw: () => ({write: jest.fn()})}
    }))
    jest.doMock('@actions/github', () => ({
      context: {
        repo: {owner: 'o', repo: 'r'},
        payload: {pull_request: {head: {sha: 'head-sha'}}},
        sha: 'ctx-sha'
      },
      getOctokit: () => octokitClient
    }))
    return coreWarning
  }

  const output = {
    title: 'Qodana for JVM',
    summary: 'sum',
    text: 'txt',
    annotations: []
  }

  test('input present: PATCH job check-run with no status/conclusion', async () => {
    const {update, listForRef, create, client} = makeOctokit()
    setupMocks(client, '12345')

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(update).toHaveBeenCalledTimes(1)
    const payload = update.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toMatchObject({owner: 'o', repo: 'r', check_run_id: 12345})
    expect(payload).not.toHaveProperty('status')
    expect(payload).not.toHaveProperty('conclusion')
    expect(payload.output).toEqual(output)
    expect(listForRef).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  test('empty input (running outside Actions or on GHES): legacy fallback', async () => {
    const {update, listForRef, create, client} = makeOctokit()
    setupMocks(client, '')

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(update).not.toHaveBeenCalled()
    expect(listForRef).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toMatchObject({
      owner: 'o',
      repo: 'r',
      head_sha: 'head-sha',
      name: 'Qodana for JVM',
      status: 'completed'
    })
  })

  test('non-numeric input: legacy fallback (no PATCH attempt)', async () => {
    const {update, create, client} = makeOctokit()
    setupMocks(client, 'not-a-number')

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(update).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledTimes(1)
  })

  test('zero / negative input: legacy fallback (no PATCH attempt)', async () => {
    for (const bad of ['0', '-1']) {
      jest.resetModules()
      const {update, create, client} = makeOctokit()
      setupMocks(client, bad)

      const {publishGitHubCheck} = require('../src/utils')
      await publishGitHubCheck(false, 'Qodana for JVM', output)

      expect(update).not.toHaveBeenCalled()
      expect(create).toHaveBeenCalledTimes(1)
    }
  })

  test('PATCH fails: warn and fall back to legacy', async () => {
    const warn = jest.fn()
    const update = jest.fn().mockRejectedValueOnce(new Error('403 denied'))
    const {listForRef, create, client} = makeOctokit({update})
    setupMocks(client, '777', warn)

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(update).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('failed to update workflow job check-run')
    )
    expect(listForRef).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
  })
})
