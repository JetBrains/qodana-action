/*
 * Copyright 2021-2024 JetBrains s.r.o.
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

import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as tc from '@actions/tool-cache'
import artifact from '@actions/artifact'
import {GitHub} from '@actions/github/lib/utils'
import {Conclusion, getGitHubCheckConclusion, Output} from './annotations'
import {
  EXECUTABLE,
  Inputs,
  VERSION,
  getProcessArchName,
  getProcessPlatformName,
  getQodanaPullArgs,
  getQodanaScanArgs,
  getQodanaSha256,
  getQodanaSha256MismatchMessage,
  getQodanaUrl,
  sha256sum,
  PushFixesType,
  NONE,
  PULL_REQUEST,
  BRANCH,
  isNativeMode,
  validateBranchName,
  compressFolder
} from '../../common/qodana'
import path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import {COMMIT_EMAIL, COMMIT_USER, prFixesBody} from './output'
import {ExecOutput} from '@actions/exec'

export const ANALYSIS_FINISHED_REACTION = '+1'
export const ANALYSIS_STARTED_REACTION = 'eyes'
const REACTIONS = [
  '+1',
  '-1',
  'laugh',
  'confused',
  'heart',
  'hooray',
  'rocket',
  'eyes'
] as const
type Reaction = (typeof REACTIONS)[number]

/**
 * The context for the action.
 * @returns The action inputs.
 */
export function getInputs(): Inputs {
  return {
    args: core
      .getInput('args')
      .split(',')
      .map(arg => arg.trim()),
    resultsDir: core.getInput('results-dir'),
    cacheDir: core.getInput('cache-dir'),
    primaryCacheKey: core.getInput('primary-cache-key'),
    additionalCacheKey: core.getInput('additional-cache-key'),
    cacheDefaultBranchOnly: core.getBooleanInput('cache-default-branch-only'),
    uploadResult: core.getBooleanInput('upload-result'),
    uploadSarif: false, // not used by the action
    artifactName: core.getInput('artifact-name'),
    useCaches: core.getBooleanInput('use-caches'),
    useAnnotations: core.getBooleanInput('use-annotations'),
    prMode: core.getBooleanInput('pr-mode'),
    postComment: core.getBooleanInput('post-pr-comment'),
    githubToken: core.getInput('github-token'),
    pushFixes: core.getInput('push-fixes'),
    commitMessage: core.getInput('commit-message'),
    useNightly: core.getBooleanInput('use-nightly')
  }
}

async function getPrSha(): Promise<string> {
  if (process.env.QODANA_PR_SHA) {
    return process.env.QODANA_PR_SHA
  }
  if (github.context.payload.pull_request !== undefined) {
    const output = await gitOutput(
      [
        'merge-base',
        github.context.payload.pull_request.base.sha,
        github.context.payload.pull_request.head.sha
      ],
      {
        ignoreReturnCode: true
      }
    )
    if (output.exitCode === 0) {
      return output.stdout.trim()
    } else {
      return github.context.payload.pull_request.base.sha
    }
  }
  return ''
}

function getHeadSha(): string {
  if (process.env.QODANA_REVISION) {
    return process.env.QODANA_REVISION
  }
  if (github.context.payload.pull_request !== undefined) {
    return github.context.payload.pull_request.head.sha
  }
  return github.context.sha
}

/**
 * Runs the qodana command with the given arguments.
 * @param inputs the action inputs.
 * @param args docker command arguments.
 * @returns The qodana command execution output.
 */
export async function qodana(
  inputs: Inputs,
  args: string[] = []
): Promise<number> {
  if (args.length === 0) {
    args = getQodanaScanArgs(inputs.args, inputs.resultsDir, inputs.cacheDir)
    if (inputs.prMode) {
      const sha = await getPrSha()
      if (sha !== '') {
        args.push('--commit', sha)
      }
    }
  }
  return (
    await exec.getExecOutput(EXECUTABLE, args, {
      ignoreReturnCode: true,
      env: {
        ...process.env,
        QODANA_REVISION: getHeadSha(),
        NONINTERACTIVE: '1'
      }
    })
  ).exitCode
}

export async function pushQuickFixes(
  mode: PushFixesType,
  commitMessage: string
): Promise<void> {
  if (mode === NONE) {
    return
  }
  try {
    const c = github.context
    let currentBranch = c.ref
    if (c.payload.pull_request?.head.ref !== undefined) {
      currentBranch = c.payload.pull_request.head.ref
    }
    const currentCommit = (
      await exec.getExecOutput('git', ['rev-parse', 'HEAD'])
    ).stdout.trim()
    currentBranch = validateBranchName(currentBranch)
    await git(['config', 'user.name', COMMIT_USER])
    await git(['config', 'user.email', COMMIT_EMAIL])
    await git(['add', '.'])
    let exitCode = await git(['commit', '-m', commitMessage], {
      ignoreReturnCode: true
    })
    if (exitCode !== 0) {
      return
    }
    exitCode = await git(['pull', '--rebase', 'origin', currentBranch])
    if (exitCode !== 0) {
      return
    }
    if (mode === BRANCH) {
      await git(['push', 'origin', currentBranch])
    } else if (mode === PULL_REQUEST) {
      const newBranch = `qodana/quick-fixes-${currentCommit.slice(0, 7)}`
      await git(['checkout', '-b', newBranch])
      await git(['push', 'origin', newBranch])
      await createPr(
        commitMessage,
        `${c.repo.owner}/${c.repo.repo}`,
        currentBranch,
        newBranch
      )
    }
  } catch (error) {
    core.warning(`Failed to push quick fixes – ${(error as Error).message}`)
  }
}

/**
 * Prepares the agent for qodana scan: install Qodana CLI and pull the linter.
 * @param args qodana arguments
 * @param useNightly whether to use a nightly version of Qodana CLI
 */
export async function prepareAgent(
  args: string[],
  useNightly = false
): Promise<void> {
  const arch = getProcessArchName()
  const platform = getProcessPlatformName()
  const temp = await tc.downloadTool(getQodanaUrl(arch, platform, useNightly))
  if (!useNightly) {
    const expectedChecksum = getQodanaSha256(arch, platform)
    const actualChecksum = sha256sum(temp)
    if (expectedChecksum !== actualChecksum) {
      core.setFailed(
        getQodanaSha256MismatchMessage(expectedChecksum, actualChecksum)
      )
    }
  }
  let extractRoot
  if (process.platform === 'win32') {
    extractRoot = await tc.extractZip(temp)
  } else {
    extractRoot = await tc.extractTar(temp)
  }
  core.addPath(
    await tc.cacheDir(extractRoot, EXECUTABLE, useNightly ? 'nightly' : VERSION)
  )
  if (!isNativeMode(args)) {
    const exitCode = await qodana(getInputs(), getQodanaPullArgs(args))
    if (exitCode !== 0) {
      core.setFailed(`qodana pull failed with exit code ${exitCode}`)
      return
    }
  }
}

/**
 * Uploads the Qodana report files from temp directory to GitHub job artifact.
 * @param resultsDir The path to upload report from.
 * @param artifactName Artifact upload name.
 * @param execute whether to execute promise or not.
 */
export async function uploadArtifacts(
  resultsDir: string,
  artifactName: string,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    const workingDir = path.dirname(resultsDir)
    const archivePath = path.join(workingDir, `${artifactName}.zip`)
    await compressFolder(resultsDir, archivePath)
    await artifact.uploadArtifact(artifactName, [archivePath], workingDir)
  } catch (error) {
    core.warning(`Failed to upload report – ${(error as Error).message}`)
  }
}

/**
 * Uploads the cache to GitHub Actions cache from the given path.
 * @param cacheDir The path to upload the cache from.
 * @param primaryKey Addition to the generated cache hash
 * @param reservedCacheKey The cache key to check if the cache already exists.
 * @param execute whether to execute promise or not.
 */
export async function uploadCaches(
  cacheDir: string,
  primaryKey: string,
  reservedCacheKey: string,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  if (primaryKey === reservedCacheKey) {
    core.info(
      `Cache with key ${primaryKey} already exists, skipping cache uploading...`
    )
    return
  }
  try {
    await cache.saveCache([cacheDir], primaryKey)
  } catch (error) {
    const errorMessage = (error as Error).message
    if (errorMessage.includes('Cache already exists.')) {
      core.info(
        `Cache with key ${primaryKey} already exists, skipping cache uploading...`
      )
    } else {
      core.warning(`Failed to upload caches – ${errorMessage}`)
    }
  }
}

/**
 * Restores the cache from GitHub Actions cache to the given path.
 * @param cacheDir The path to restore the cache to.
 * @param primaryKey The primary cache key.
 * @param additionalCacheKey The additional cache key.
 * @param execute whether to execute promise or not.
 */
export async function restoreCaches(
  cacheDir: string,
  primaryKey: string,
  additionalCacheKey: string,
  execute: boolean
): Promise<string> {
  if (!execute) {
    return ''
  }
  const restoreKeys = [additionalCacheKey]
  try {
    const cacheKey = await cache.restoreCache(
      [cacheDir],
      primaryKey,
      restoreKeys
    )
    if (!cacheKey) {
      core.info(
        `No cache found for input keys: ${[primaryKey, ...restoreKeys].join(
          ', '
        )}.
          With cache the pipeline would be faster.`
      )
      return ''
    }
    return cacheKey
  } catch (error) {
    core.warning(
      `Failed to restore cache with key ${primaryKey} – ${
        (error as Error).message
      }`
    )
  }
  return ''
}

/**
 * Check if need to upload the cache.
 */
export function isNeedToUploadCache(
  useCaches: boolean,
  cacheDefaultBranchOnly: boolean
): boolean {
  if (!useCaches && cacheDefaultBranchOnly) {
    core.warning(
      'Turn on "use-cache" option to use "cache-default-branch-only"'
    )
  }

  if (useCaches && cacheDefaultBranchOnly) {
    const currentBranch = github.context.payload.ref
    const defaultBranch = github.context.payload.repository?.default_branch
    core.debug(
      `Current branch: ${currentBranch} | Default branch: ${defaultBranch}`
    )
    return currentBranch === defaultBranch
  }

  return useCaches
}

/**
 * Returns the URL to the current workflow run.
 */
export function getWorkflowRunUrl(): string {
  if (!process.env['GITHUB_REPOSITORY']) {
    return ''
  }

  const runId = github.context.runId
  const repo = github.context.repo
  const serverUrl = process.env['GITHUB_SERVER_URL'] || 'https://github.com'
  return `${serverUrl}/${repo.owner}/${repo.repo}/actions/runs/${runId}`
}

function getIssueNumber(): number {
  // var issueNumber = github.context.payload.pull_request?.number as number
  // if (!issueNumber) {
  //
  // }
  // TODO: Remove these TEMP logs!
  core.info(`Issue number: ${github.context.issue.number}`)
  core.info(
    `PR number: ${github.context.payload.pull_request?.number as number}`
  )

  return github.context.issue.number
}

/**
 * Post a new comment to the pull request.
 * @param toolName The name of the tool to mention in comment.
 * @param content The comment to post.
 * @param postComment Whether to post a comment or not.
 */
export async function postResultsToPRComments(
  toolName: string,
  content: string,
  postComment: boolean
): Promise<void> {
  const pr = github.context.payload.pull_request ?? ''
  if (!postComment || !pr) {
    core.info(`Not a PR. Do we have a issue number? ${getIssueNumber()}`)
    return
  }
  const comment_tag_pattern = `<!-- JetBrains/qodana-action@v${VERSION} : ${toolName} -->`
  const body = `${content}\n${comment_tag_pattern}`
  const client = github.getOctokit(getInputs().githubToken)
  const comment_id = await findCommentByTag(client, comment_tag_pattern)
  if (comment_id !== -1) {
    await updateComment(client, comment_id, body)
  } else {
    await createComment(client, body)
  }
}

/**
 * Asynchronously finds a comment on the GitHub issue and returns its ID based on the provided tag. If the
 * comment is not found, returns -1. Utilizes GitHub's Octokit REST API client.
 *
 * @param client The Octokit REST API client to be used for searching for the comment.
 * @param tag The string to be searched for in the comments' body.
 * @returns A Promise resolving to the comment's ID if found, or -1 if not found or an error occurs.
 */
export async function findCommentByTag(
  client: InstanceType<typeof GitHub>,
  tag: string
): Promise<number> {
  try {
    const {data: comments} = await client.rest.issues.listComments({
      ...github.context.repo,
      issue_number: getIssueNumber()
    })
    const comment = comments.find(c => c?.body?.includes(tag))
    return comment ? comment.id : -1
  } catch (error) {
    core.debug(`Failed to find comment by tag – ${(error as Error).message}`)
    return -1
  }
}

/**
 * Asynchronously creates a comment on the current issue using the provided body text.
 * @param client The Octokit REST API client to be used for creating the comment.
 * @param body The text content of the comment to be created.
 * @returns A Promise that resolves when the comment is successfully created.
 */
export async function createComment(
  client: InstanceType<typeof GitHub>,
  body: string
): Promise<void> {
  try {
    await client.rest.issues.createComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: getIssueNumber(),
      body
    })
  } catch (error) {
    core.debug(`Failed to post comment – ${(error as Error).message}`)
  }
}

/**
 * Asynchronously updates a GitHub comment with the provided `comment_id` and new content/`body`.
 * Handles any occurring errors
 * internally by debugging them.
 *
 * @param client The Octokit REST API client to be used for updating the comment.
 * @param comment_id The ID of the GitHub comment to be updated.
 * @param body The new content of the comment.
 * @returns A Promise that resolves to void after attempted comment update.
 */
export async function updateComment(
  client: InstanceType<typeof GitHub>,
  comment_id: number,
  body: string
): Promise<void> {
  try {
    await client.rest.issues.updateComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      comment_id,
      body
    })
  } catch (error) {
    core.debug(`Failed to update comment – ${(error as Error).message}`)
  }
}

/**
 * Updates the reaction of a pull request review comment to the given 'newReaction'.
 * Removes the previous reaction if 'oldReaction' is non-empty.
 *
 * @param newReaction The new reaction to be added.
 * @param oldReaction The old reaction to be removed (if non-empty).
 * @returns A Promise resolving to void.
 */
export async function putReaction(
  newReaction: Reaction,
  oldReaction: string
): Promise<void> {
  const client = github.getOctokit(getInputs().githubToken)

  const issue_number = getIssueNumber()
  if (oldReaction !== '') {
    try {
      const {data: reactions} = await client.rest.reactions.listForIssue({
        ...github.context.repo,
        issue_number
      })
      const previousReaction = reactions.find(r => r.content === oldReaction)
      if (previousReaction) {
        await client.rest.reactions.deleteForIssue({
          ...github.context.repo,
          issue_number,
          reaction_id: previousReaction.id
        })
      }
    } catch (error) {
      core.debug(
        `Failed to delete the initial reaction – ${(error as Error).message}`
      )
    }
  }

  try {
    await client.rest.reactions.createForIssue({
      ...github.context.repo,
      issue_number,
      content: newReaction
    })
  } catch (error) {
    core.debug(`Failed to set reaction – ${(error as Error).message}`)
  }
}

/**
 * Publish GitHub Checks output to GitHub Checks.
 * @param failedByThreshold flag if the Qodana failThreshold was reached.
 * @param name The name of the Check.
 * @param output The output to publish.
 */
export async function publishGitHubCheck(
  failedByThreshold: boolean,
  name: string,
  output: Output
): Promise<void> {
  const conclusion = getGitHubCheckConclusion(
    output.annotations,
    failedByThreshold
  )
  let sha = github.context.sha
  if (github.context.payload.pull_request) {
    sha = github.context.payload.pull_request.head.sha
  }
  const client = github.getOctokit(getInputs().githubToken)
  const result = await client.rest.checks.listForRef({
    ...github.context.repo,
    ref: sha
  })
  const checkExists = result.data.check_runs.find(check => check.name === name)
  if (checkExists) {
    await updateCheck(client, conclusion, checkExists.id, output)
  } else {
    await createCheck(client, conclusion, sha, name, output)
  }
}

/**
 * Creates a GitHub Check.
 * @param client The Octokit REST API client to be used for creating the Check.
 * @param conclusion The conclusion to use for the GitHub Check.
 * @param head_sha The SHA of the head commit.
 * @param name The name of the Check.
 * @param output The Check Output to use.
 */
async function createCheck(
  client: InstanceType<typeof GitHub>,
  conclusion: Conclusion,
  head_sha: string,
  name: string,
  output: Output
): Promise<void> {
  await client.rest.checks.create({
    ...github.context.repo,
    accept: 'application/vnd.github.v3+json',
    status: 'completed',
    head_sha,
    conclusion,
    name,
    output
  })
}

/**
 * Updates a GitHub Check.
 * @param client The Octokit REST API client to be used for updating the Check.
 * @param conclusion The conclusion to use for the GitHub Check.
 * @param check_run_id The ID of the GitHub Check to use for the update.
 * @param output The Check Output to use.
 */
async function updateCheck(
  client: InstanceType<typeof GitHub>,
  conclusion: Conclusion,
  check_run_id: number,
  output: Output
): Promise<void> {
  await client.rest.checks.update({
    ...github.context.repo,
    accept: 'application/vnd.github.v3+json',
    status: 'completed',
    conclusion,
    check_run_id,
    output
  })
}

async function git(
  args: string[],
  options: exec.ExecOptions = {}
): Promise<number> {
  return (await exec.getExecOutput('git', args, options)).exitCode
}

async function gitOutput(
  args: string[],
  options: exec.ExecOptions = {}
): Promise<ExecOutput> {
  return await exec.getExecOutput('git', args, options)
}

async function createPr(
  title: string,
  repo: string,
  base: string,
  head: string
): Promise<void> {
  const prBodyFile = path.join(os.tmpdir(), 'pr-body.txt')
  fs.writeFileSync(prBodyFile, prFixesBody(getWorkflowRunUrl()))
  await exec.getExecOutput(
    'gh',
    [
      'pr',
      'create',
      '--repo',
      repo,
      '--title',
      title,
      '--body-file',
      prBodyFile,
      '--base',
      base,
      '--head',
      head
    ],
    {
      env: {
        ...process.env,
        GH_TOKEN: getInputs().githubToken
      }
    }
  )
}
