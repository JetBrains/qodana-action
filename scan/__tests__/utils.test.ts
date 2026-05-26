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

describe('publishGitHubCheck — job check-run resolution', () => {
  const ENV_KEYS = [
    'GITHUB_ACTIONS',
    'GITHUB_RUN_ID',
    'GITHUB_JOB',
    'RUNNER_NAME'
  ] as const
  const savedEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    jest.resetModules()
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k]
  })

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k]
      else process.env[k] = savedEnv[k]
    }
  })

  type Job = {
    id: number
    name: string
    runner_name: string | null
    status: string
  }

  function makeOctokit(
    jobs: Job[],
    overrides: {
      paginateImpl?: (
        endpoint: unknown,
        params: unknown
      ) => Promise<Job[]> | Job[]
      listJobsImpl?: () => Promise<{data: {jobs: Job[]}}>
      update?: jest.Mock
      listForRefImpl?: () => Promise<unknown>
      createImpl?: () => Promise<unknown>
    } = {}
  ): {
    paginate: jest.Mock
    listJobs: jest.Mock
    update: jest.Mock
    listForRef: jest.Mock
    create: jest.Mock
    client: unknown
  } {
    const listJobs = jest.fn(
      overrides.listJobsImpl ?? (async () => ({data: {jobs}}))
    )
    const paginate = jest.fn(
      overrides.paginateImpl ?? (async () => jobs)
    ) as jest.Mock
    const update = overrides.update ?? jest.fn(async () => ({}))
    const listForRef = jest.fn(
      overrides.listForRefImpl ?? (async () => ({data: {check_runs: []}}))
    )
    const create = jest.fn(overrides.createImpl ?? (async () => ({})))
    const client = {
      paginate,
      rest: {
        actions: {listJobsForWorkflowRun: listJobs},
        checks: {update, listForRef, create}
      }
    }
    return {paginate, listJobs, update, listForRef, create, client}
  }

  function setupMocks(
    octokitClient: unknown,
    coreWarning: jest.Mock = jest.fn()
  ): jest.Mock {
    jest.doMock('@actions/core', () => ({
      getInput: (name: string) => (name === 'github-token' ? 'tkn' : ''),
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

  function setActionsEnv(
    overrides: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}
  ): void {
    process.env.GITHUB_ACTIONS = 'true'
    process.env.GITHUB_RUN_ID = '99'
    process.env.GITHUB_JOB = 'qodana'
    process.env.RUNNER_NAME = 'GitHub-Hosted-1'
    for (const [k, v] of Object.entries(overrides)) {
      process.env[k] = v
    }
  }

  test('exact GITHUB_JOB match: PATCH job check-run with no status/conclusion', async () => {
    setActionsEnv()
    const {paginate, update, listForRef, create, client} = makeOctokit([
      {
        id: 12345,
        name: 'qodana',
        runner_name: 'GitHub-Hosted-1',
        status: 'in_progress'
      }
    ])
    setupMocks(client)

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(paginate).toHaveBeenCalledTimes(1)
    const paginateParams = paginate.mock.calls[0][1] as Record<string, unknown>
    expect(paginateParams).toMatchObject({
      owner: 'o',
      repo: 'r',
      run_id: 99,
      filter: 'latest',
      per_page: 100
    })
    expect(paginateParams).not.toHaveProperty('attempt_number')
    expect(update).toHaveBeenCalledTimes(1)
    const payload = update.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toMatchObject({owner: 'o', repo: 'r', check_run_id: 12345})
    expect(payload).not.toHaveProperty('status')
    expect(payload).not.toHaveProperty('conclusion')
    expect(payload.output).toEqual(output)
    expect(listForRef).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  test('paginated jobs: candidate on page 2 is still found', async () => {
    setActionsEnv()
    const pageJobs: Job[] = [
      ...Array.from({length: 100}, (_, i) => ({
        id: i + 1,
        name: `other-job-${i}`,
        runner_name: `R${i}`,
        status: 'completed'
      })),
      {
        id: 999,
        name: 'qodana',
        runner_name: 'GitHub-Hosted-1',
        status: 'in_progress'
      }
    ]
    const {paginate, update, client} = makeOctokit([], {
      paginateImpl: async () => pageJobs
    })
    setupMocks(client)

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(paginate).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({check_run_id: 999})
    )
  })

  test('matrix prefix match with in_progress tie-break', async () => {
    setActionsEnv()
    const {update, client} = makeOctokit([
      {
        id: 100,
        name: 'qodana (ubuntu-latest)',
        runner_name: 'A',
        status: 'completed'
      },
      {
        id: 200,
        name: 'qodana (macos-latest)',
        runner_name: 'B',
        status: 'in_progress'
      },
      {
        id: 300,
        name: 'qodana (windows-latest)',
        runner_name: 'C',
        status: 'completed'
      }
    ])
    setupMocks(client)

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0]).toMatchObject({check_run_id: 200})
  })

  test('matrix with multiple in_progress: RUNNER_NAME disambiguates', async () => {
    // All three matrix children are concurrently in_progress (real-world case
    // when matrix children start at the same time). Only RUNNER_NAME uniquely
    // identifies the current process's leg.
    setActionsEnv({RUNNER_NAME: 'GitHub-Actions-2'})
    const {update, client} = makeOctokit([
      {
        id: 111,
        name: 'qodana (ubuntu)',
        runner_name: 'GitHub-Actions-1',
        status: 'in_progress'
      },
      {
        id: 222,
        name: 'qodana (macos)',
        runner_name: 'GitHub-Actions-2',
        status: 'in_progress'
      },
      {
        id: 333,
        name: 'qodana (windows)',
        runner_name: 'GitHub-Actions-3',
        status: 'in_progress'
      }
    ])
    setupMocks(client)

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({check_run_id: 222})
    )
  })

  test('name: override → RUNNER_NAME fallback', async () => {
    setActionsEnv({RUNNER_NAME: 'GitHub-Actions-7'})
    const {update, client} = makeOctokit([
      {
        id: 1,
        name: 'Some Display Name',
        runner_name: 'GitHub-Actions-7',
        status: 'in_progress'
      },
      {
        id: 2,
        name: 'Other Job',
        runner_name: 'GitHub-Actions-3',
        status: 'completed'
      }
    ])
    setupMocks(client)

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({check_run_id: 1})
    )
  })

  test('GITHUB_ACTIONS unset → legacy fallback (listForRef + create)', async () => {
    delete process.env.GITHUB_ACTIONS
    const {paginate, listForRef, create, update, client} = makeOctokit([])
    setupMocks(client)

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(paginate).not.toHaveBeenCalled()
    expect(listForRef).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
    expect(update).not.toHaveBeenCalled()
    // Verify create payload preserves legacy behavior
    expect(create.mock.calls[0][0]).toMatchObject({
      owner: 'o',
      repo: 'r',
      head_sha: 'head-sha',
      name: 'Qodana for JVM',
      status: 'completed'
    })
  })

  test('missing GITHUB_RUN_ID → legacy fallback, no paginate call', async () => {
    setActionsEnv()
    delete process.env.GITHUB_RUN_ID
    const {paginate, create, client} = makeOctokit([])
    setupMocks(client)

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(paginate).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledTimes(1)
  })

  test('paginate rejects → warning + legacy fallback', async () => {
    setActionsEnv()
    const warn = jest.fn()
    const {paginate, create, client} = makeOctokit([], {
      paginateImpl: async () => {
        throw new Error('boom')
      }
    })
    setupMocks(client, warn)

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(paginate).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'))
    expect(create).toHaveBeenCalledTimes(1)
  })

  test('no matching job → warning + legacy fallback (cached)', async () => {
    setActionsEnv()
    const warn = jest.fn()
    const {paginate, create, client} = makeOctokit([
      {id: 1, name: 'unrelated', runner_name: 'X', status: 'completed'}
    ])
    setupMocks(client, warn)

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(paginate).toHaveBeenCalledTimes(1) // cached after first failure
    expect(warn).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(2)
  })

  test('caching: second publishGitHubCheck call uses cached job id', async () => {
    setActionsEnv()
    const {paginate, update, client} = makeOctokit([
      {
        id: 7,
        name: 'qodana',
        runner_name: 'GitHub-Hosted-1',
        status: 'in_progress'
      }
    ])
    setupMocks(client)

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(paginate).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(2)
    expect(update.mock.calls[0][0]).toMatchObject({check_run_id: 7})
    expect(update.mock.calls[1][0]).toMatchObject({check_run_id: 7})
  })

  test('PATCH failure → invalidates cache, falls back to legacy on this and subsequent calls', async () => {
    setActionsEnv()
    const warn = jest.fn()
    const update = jest
      .fn()
      .mockRejectedValueOnce(new Error('403 update denied'))
    const {paginate, listForRef, create, client} = makeOctokit(
      [
        {
          id: 9,
          name: 'qodana',
          runner_name: 'GitHub-Hosted-1',
          status: 'in_progress'
        }
      ],
      {update}
    )
    setupMocks(client, warn)

    const {publishGitHubCheck} = require('../src/utils')
    await publishGitHubCheck(false, 'Qodana for JVM', output)
    await publishGitHubCheck(false, 'Qodana for JVM', output)

    expect(paginate).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1) // only the first call attempts PATCH
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('failed to update workflow job check-run')
    )
    // Both calls fell through to the legacy path
    expect(listForRef).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenCalledTimes(2)
  })
})
