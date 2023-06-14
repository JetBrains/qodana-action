import * as artifact from '@actions/artifact'
import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as glob from '@actions/glob'
import * as tc from '@actions/tool-cache'
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
  sha256sum
} from '../../common/qodana'
import path from 'path'
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
type Reaction = typeof REACTIONS[number]

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
    additionalCacheKey:
      core.getInput('additional-cache-key') ||
      core.getInput('additional-cache-hash'),
    cacheDefaultBranchOnly: core.getBooleanInput('cache-default-branch-only'),
    uploadResult: core.getBooleanInput('upload-result'),
    uploadSarif: false, // not used by the action
    artifactName: core.getInput('artifact-name'),
    useCaches: core.getBooleanInput('use-caches'),
    useAnnotations: core.getBooleanInput('use-annotations'),
    prMode: core.getBooleanInput('pr-mode'),
    postComment: core.getBooleanInput('post-pr-comment'),
    githubToken: core.getInput('github-token')
  }
}
/**
 * Runs the qodana command with the given arguments.
 * @param args docker command arguments.
 * @returns The qodana command execution output.
 */
export async function qodana(args: string[] = []): Promise<number> {
  if (args.length === 0) {
    const inputs = getInputs()
    args = getQodanaScanArgs(inputs.args, inputs.resultsDir, inputs.cacheDir)
    if (isPRMode() && github.context.payload.pull_request !== undefined) {
      const pr = github.context.payload.pull_request
      args.push('--commit', `CI${pr.base.sha}`)
    }
  }
  return (
    await exec.getExecOutput(EXECUTABLE, args, {
      ignoreReturnCode: true,
      env: {
        ...process.env,
        NONINTERACTIVE: '1'
      }
    })
  ).exitCode
}

/**
 * Prepares the agent for qodana scan: install Qodana CLI and pull the linter.
 * @param args qodana arguments
 */
export async function prepareAgent(args: string[]): Promise<void> {
  const arch = getProcessArchName()
  const platform = getProcessPlatformName()
  const expectedChecksum = getQodanaSha256(arch, platform)
  const temp = await tc.downloadTool(getQodanaUrl(arch, platform))
  const actualChecksum = sha256sum(temp)
  if (expectedChecksum !== actualChecksum) {
    core.setFailed(
      getQodanaSha256MismatchMessage(expectedChecksum, actualChecksum)
    )
  }
  let extractRoot
  if (process.platform === 'win32') {
    extractRoot = await tc.extractZip(temp)
  } else {
    extractRoot = await tc.extractTar(temp)
  }
  core.addPath(await tc.cacheDir(extractRoot, EXECUTABLE, VERSION))
  const exitCode = await qodana(getQodanaPullArgs(args))
  if (exitCode !== 0) {
    core.setFailed(`qodana pull failed with exit code ${exitCode}`)
    return
  }
}

/**
 * Uploads the Qodana report files from temp directory to GitHub job artifact.
 * @param resultsDir The path to upload report from.
 * @param artifactName Artifact upload name.
 * @param execute whether to execute promise or not.
 */
export async function uploadReport(
  resultsDir: string,
  artifactName: string,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    core.info('Uploading report...')
    const globber = await glob.create(`${resultsDir}/*`)
    const files = await globber.glob()
    await artifact
      .create()
      .uploadArtifact(artifactName, files, path.dirname(resultsDir), {
        continueOnError: true
      })
  } catch (error) {
    core.warning(`Failed to upload report – ${(error as Error).message}`)
  }
}

/**
 * Uploads the cache to GitHub Actions cache from the given path.
 * @param cacheDir The path to upload the cache from.
 * @param primaryKey Addition to the generated cache hash
 * @param execute whether to execute promise or not.
 */
export async function uploadCaches(
  cacheDir: string,
  primaryKey: string,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    if (isServer()) {
      core.warning(
        'Cache is not supported on GHES. See https://github.com/actions/cache/issues/505 for more details'
      )
      return
    }
    try {
      await cache.saveCache([cacheDir], primaryKey)
      core.info(`Cache saved with key ${primaryKey}`)
    } catch (error) {
      core.warning(
        `Failed to save cache with key ${primaryKey} – ${
          (error as Error).message
        }`
      )
    }
  } catch (error) {
    core.warning(`Failed to upload caches – ${(error as Error).message}`)
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
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    if (isServer()) {
      core.warning(
        'Cache is not supported on GHES. See https://github.com/actions/cache/issues/505 for more details'
      )
      return
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
          `Cache not found for input keys: ${[primaryKey, ...restoreKeys].join(
            ', '
          )}`
        )
        return
      }
      core.info(`Cache restored from key: ${cacheKey}`)
    } catch (error) {
      core.warning(
        `Failed to restore cache with key ${primaryKey} – ${
          (error as Error).message
        }`
      )
    }
  } catch (error) {
    core.warning(`Failed to download caches – ${(error as Error).message}`)
  }
}

/**
 * Check if the action is run on GHE.
 */
export function isServer(): boolean {
  const ghUrl = new URL(
    process.env['GITHUB_SERVER_URL'] || 'https://github.com'
  )
  return ghUrl.hostname.toUpperCase() !== 'GITHUB.COM'
}

/**
 * Determines if the action is running in PR mode.
 * @returns {boolean} - true if the action is running in PR mode, false otherwise.
 */
export function isPRMode(): boolean {
  return github.context.payload.pull_request !== undefined && getInputs().prMode
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
 * Generates a plural form of the word "problem" depending on the given count.
 * @param count - A number representing the count of problems
 * @returns A formatted string with the correct plural form of "problem"
 */
export function getProblemPlural(count: number): string {
  return `new problem${count !== 1 ? 's' : ''}`
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

/**
 * Asynchronously finds a comment on the GitHub issue and returns its ID based on the provided tag. If the
 * comment is not found, returns -1. Utilizes GitHub's Octokit REST API client.
 *
 * @param tag - The string to be searched for in the comments' body.
 * @returns A Promise resolving to the comment's ID if found, or -1 if not found or an error occurs.
 */
export async function findCommentByTag(tag: string): Promise<number> {
  const client = github.getOctokit(getInputs().githubToken)

  try {
    const {data: comments} = await client.rest.issues.listComments({
      ...github.context.repo,
      issue_number: github.context.issue.number
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
 * @param body - The text content of the comment to be created.
 * @returns A Promise that resolves when the comment is successfully created.
 */
export async function createComment(body: string): Promise<void> {
  const client = github.getOctokit(getInputs().githubToken)

  try {
    await client.rest.issues.createComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: github.context.issue.number,
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
 * @param comment_id - The ID of the GitHub comment to be updated.
 * @param body - The new content of the comment.
 * @returns A Promise that resolves to void after attempted comment update.
 */
export async function updateComment(
  comment_id: number,
  body: string
): Promise<void> {
  const client = github.getOctokit(getInputs().githubToken)

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

  const issue_number = github.context.payload.pull_request?.number as number
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
      core.warning(
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
    core.warning(`Failed to set reaction – ${(error as Error).message}`)
  }
}
