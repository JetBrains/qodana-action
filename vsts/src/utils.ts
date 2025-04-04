/*
 * Copyright 2021-2025 JetBrains s.r.o.
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

import * as tl from 'azure-pipelines-task-lib/task'
import * as tool from 'azure-pipelines-tool-lib'
import {IExecOptions} from 'azure-pipelines-task-lib/toolrunner'
import {Writable} from 'node:stream'
import fs from 'fs'
import path from 'path'
import * as GitInterfaces from 'azure-devops-node-api/interfaces/GitInterfaces'

import {
  BRANCH,
  compressFolder,
  EXECUTABLE,
  getProcessArchName,
  getProcessPlatformName,
  getQodanaPullArgs,
  getQodanaScanArgs,
  getQodanaSha256,
  getQodanaSha256MismatchMessage,
  getQodanaUrl,
  Inputs,
  isNativeMode,
  NONE,
  PULL_REQUEST,
  PushFixesType,
  sha256sum,
  validateBranchName,
  VERSION
} from '../../common/qodana'
import {COMMIT_EMAIL, COMMIT_USER, getCommentTag} from '../../common/output'
import {getGitApi} from './gitApiProvider'
import {prFixesBody} from './output'

export function setFailed(message: string): void {
  tl.setResult(tl.TaskResult.Failed, message)
}

/**
 * The context for the task.
 * @returns The Azure DevOps Pipeline inputs.
 */
export function getInputs(): Inputs {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const home = path.join(process.env['AGENT_TEMPDIRECTORY']!, 'qodana')
  return {
    args: (tl.getInput('args', false) || '').split(',').map(arg => arg.trim()),
    resultsDir: tl.getInput('resultsDir', false) || path.join(home, 'results'),
    cacheDir: tl.getInput('cacheDir', false) || path.join(home, 'cache'),
    uploadResult: tl.getBoolInput('uploadResult', false),
    uploadSarif: tl.getBoolInput('uploadSarif', false),
    artifactName: tl.getInput('artifactName', false) || 'qodana-report',
    useNightly: tl.getBoolInput('useNightly', false),
    prMode: tl.getBoolInput('prMode', false),
    postComment: tl.getBoolInput('postPrComment', false),
    pushFixes: tl.getInput('pushFixes', false) || 'none',
    commitMessage:
      tl.getInput('commitMessage', false) ||
      '🤖 Apply quick-fixes by Qodana \n\n[skip ci]',
    // Not used by the Azure task
    additionalCacheKey: '',
    primaryCacheKey: '',
    useAnnotations: false,
    useCaches: false,
    cacheDefaultBranchOnly: false,
    githubToken: ''
  }
}

/**
 * Runs the qodana command with the given arguments.
 * @param args docker command arguments.
 * @returns The qodana command execution output.
 */
export async function qodana(args: string[] = []): Promise<number> {
  const env: Record<string, string> = {
    ...process.env,
    NONINTERACTIVE: '1'
  }
  if (args.length === 0) {
    const inputs = getInputs()
    args = getQodanaScanArgs(inputs.args, inputs.resultsDir, inputs.cacheDir)
    if (inputs.prMode && tl.getVariable('Build.Reason') === 'PullRequest') {
      const sha = await getPrSha()
      if (sha !== '') {
        args.push('--commit', sha)
        const sourceBranch =
          process.env.QODANA_BRANCH || getSourceAndTargetBranches().sourceBranch
        if (sourceBranch) {
          env.QODANA_BRANCH = sourceBranch
        }
      }
    }
  }
  return await tl.execAsync(EXECUTABLE, args, {
    ignoreReturnCode: true,
    env
  })
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
  const temp = await tool.downloadTool(getQodanaUrl(arch, platform, useNightly))
  if (!useNightly) {
    const expectedChecksum = getQodanaSha256(arch, platform)
    const actualChecksum = sha256sum(temp)
    if (expectedChecksum !== actualChecksum) {
      setFailed(
        getQodanaSha256MismatchMessage(expectedChecksum, actualChecksum)
      )
    }
  }
  let extractRoot
  if (process.platform === 'win32') {
    extractRoot = await tool.extractZip(temp)
  } else {
    extractRoot = await tool.extractTar(temp)
  }
  tool.prependPath(await tool.cacheDir(extractRoot, EXECUTABLE, VERSION))
  if (!isNativeMode(args)) {
    const pull = await qodana(getQodanaPullArgs(args))
    if (pull !== 0) {
      setFailed("Unable to run 'qodana pull'")
    }
  }
}

/**
 * Uploads the Qodana report files from temp directory to Azure DevOps Pipelines job artifact.
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
    tl.uploadArtifact('Qodana', archivePath, artifactName)
  } catch (error) {
    tl.warning(`Failed to upload report – ${(error as Error).message}`)
  }
}

/**
 * Uploads the qodana.sarif.json from temp directory to Azure DevOps Pipelines job qodana.sarif artifact.
 * @param resultsDir The path to upload a report from.
 * @param execute whether to execute promise or not.
 */
export function uploadSarif(resultsDir: string, execute: boolean): void {
  if (!execute) {
    return
  }
  try {
    const parentDir = path.dirname(resultsDir)
    const qodanaSarif = path.join(parentDir, 'qodana.sarif')
    tl.cp(path.join(resultsDir, 'qodana.sarif.json'), qodanaSarif)
    tl.uploadArtifact('CodeAnalysisLogs', qodanaSarif, 'CodeAnalysisLogs')
  } catch (error) {
    tl.warning(`Failed to upload SARIF – ${(error as Error).message}`)
  }
}

function getSourceAndTargetBranches(): {
  sourceBranch?: string
  targetBranch?: string
} {
  const sourceBranch = tl
    .getVariable('System.PullRequest.SourceBranch')
    ?.replace('refs/heads/', '')
  const targetBranch = tl
    .getVariable('System.PullRequest.TargetBranch')
    ?.replace('refs/heads/', '')
  return {sourceBranch, targetBranch}
}

async function getPrSha(): Promise<string> {
  if (process.env.QODANA_PR_SHA) {
    return process.env.QODANA_PR_SHA
  }
  const {sourceBranch, targetBranch} = getSourceAndTargetBranches()

  if (sourceBranch && targetBranch) {
    await git(['fetch', 'origin'])
    const output = await gitOutput(
      ['merge-base', 'origin/' + sourceBranch, 'origin/' + targetBranch],
      {
        ignoreReturnCode: true
      }
    )
    if (output.exitCode === 0) {
      return output.stdout.trim()
    }
  }
  return ''
}

async function git(
  args: string[],
  options: IExecOptions = {}
): Promise<number> {
  return (await gitOutput(args, options)).exitCode
}

/**
 * Returns trimmed output of git command omitting the command itself
 * i.e., if gitOutput(['status']) is called the "/usr/bin/git status" will be omitted
 * @param args git arguments
 * @param options options for azure-pipelines-task-lib/task exec
 */
async function gitOutput(
  args: string[],
  options: IExecOptions = {}
): Promise<{exitCode: number; stderr: string; stdout: string}> {
  const result = {
    exitCode: 0,
    stdout: '',
    stderr: ''
  }

  const outStream = new Writable({
    write(chunk, _, callback) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      result.stdout += chunk.toString('utf8')
      callback()
    }
  })

  const errStream = new Writable({
    write(chunk, _, callback) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      result.stderr += chunk.toString('utf8')
      callback()
    }
  })
  options.outStream = outStream
  options.errStream = errStream

  result.exitCode = await tl.execAsync('git', args, options).catch(error => {
    tl.warning(`Failed to run git command with arguments: ${args.join(' ')}`)
    throw error
  })
  result.stdout = result.stdout
    .replace('[command]/usr/bin/git ' + args.join(' '), '')
    .trim()
  return result
}

/**
 * Returns the URL to the current pipeline run.
 */
export function getWorkflowRunUrl(): string {
  const serverUri = process.env.SYSTEM_TEAMFOUNDATIONSERVERURI
  const projectName = process.env.SYSTEM_TEAMPROJECT
  const buildId = process.env.BUILD_BUILDID
  return `${serverUri}${projectName}/_build/results?buildId=${buildId}`
}

/**
 * Post a new comment to the pull request.
 * @param toolName The name of the tool to mention in comment.
 * @param sourceDir The analyzed directory inside project
 * @param content The comment to post.
 * @param hasIssues Indicates whether Qodana found any problems
 * @param postComment Whether to post a comment or not.
 */
export async function postResultsToPRComments(
  toolName: string,
  sourceDir: string,
  content: string,
  hasIssues: boolean,
  postComment: boolean
): Promise<void> {
  try {
    if (!postComment) {
      return
    }
    const comment_tag_pattern = getCommentTag(toolName, sourceDir)
    const body = `${content}\n${comment_tag_pattern}`

    const pullRequestId = parseInt(
      getVariable('System.PullRequest.PullRequestId'),
      10
    )
    const project = getVariable('System.TeamProject')
    const repoId = getVariable('Build.Repository.Id')
    const gitApi = await getGitApi()
    const {thread, comment} = await findCommentByTag(comment_tag_pattern)
    const newComment = {
      content: body
    }

    if (comment?.id === undefined || thread?.id === undefined) {
      const thread: GitInterfaces.CommentThread = {
        comments: [newComment],
        status: hasIssues
          ? GitInterfaces.CommentThreadStatus.Active
          : GitInterfaces.CommentThreadStatus.ByDesign
      }
      await gitApi.createThread(thread, repoId, pullRequestId, project)
    } else {
      const threadStatusUpdated: GitInterfaces.CommentThread = {
        status: hasIssues
          ? GitInterfaces.CommentThreadStatus.Active
          : GitInterfaces.CommentThreadStatus.ByDesign
      }
      await gitApi.updateThread(
        threadStatusUpdated,
        repoId,
        pullRequestId,
        thread.id,
        project
      )
      await gitApi.updateComment(
        newComment,
        repoId,
        pullRequestId,
        thread.id,
        comment.id,
        project
      )
    }
  } catch (error) {
    tl.warning(`Failed to post results to comment: ${(error as Error).message}`)
  }
}

/**
 * Asynchronously finds a comment on the Azure pull request and returns its ID based on the provided tag.
 *
 * @param tag The string to be searched for in the comments' body.
 * @returns A Promise resolving to the comment and containing thread if found, or undefined for both if not found or an error occurs.
 */
async function findCommentByTag(tag: string): Promise<{
  thread: GitInterfaces.CommentThread | undefined
  comment: GitInterfaces.Comment | undefined
}> {
  try {
    const gitApi = await getGitApi()
    const project = getVariable('System.TeamProject')
    const repoId = getVariable('Build.Repository.Id')
    const pullRequestId = parseInt(
      getVariable('System.PullRequest.PullRequestId'),
      10
    )
    const threads = await gitApi.getThreads(repoId, pullRequestId, project)
    for (const thread of threads) {
      const comment = thread.comments?.find(comment =>
        comment.content?.includes(tag)
      )
      if (comment != undefined) {
        return {thread: thread, comment: comment}
      }
    }
    return {thread: undefined, comment: undefined}
  } catch (error) {
    tl.debug(`Failed to find comment by tag – ${(error as Error).message}`)
    return {thread: undefined, comment: undefined}
  }
}

export function getVariable(name: string): string {
  const result = tl.getVariable(name)
  if (!result) {
    throw new Error(`Variable ${name} is not set`)
  }
  return result
}

export function postSummary(summary: string): void {
  const tempDir = getVariable('Agent.TempDirectory')
  const filePath = path.join(tempDir, 'Qodana Task Summary.md')
  fs.writeFileSync(filePath, summary)
  tl.uploadSummary(filePath)
}

export async function pushQuickFixes(
  mode: PushFixesType,
  commitMessage: string
): Promise<void> {
  if (mode === NONE) {
    return
  }
  try {
    const pullRequest = tl.getVariable('Build.Reason') === 'PullRequest'
    let currentBranch
    if (pullRequest) {
      currentBranch = getVariable('System.PullRequest.SourceBranch')
    } else {
      currentBranch = getVariable('Build.SourceBranch')
    }
    currentBranch = currentBranch.replace('refs/heads/', '')
    currentBranch = validateBranchName(currentBranch)

    const currentCommit = (await gitOutput(['rev-parse', 'HEAD'])).stdout.trim()
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
      const commitToCherryPick = (
        await gitOutput(['rev-parse', 'HEAD'])
      ).stdout.trim()
      await git(['checkout', currentBranch])
      await git(['cherry-pick', commitToCherryPick])
      await gitPush(currentBranch)
    } else if (mode === PULL_REQUEST) {
      const newBranch = `qodana/quick-fixes-${currentCommit.slice(0, 7)}`
      await git(['checkout', '-b', newBranch])
      await gitPush(newBranch)
      await createPr(commitMessage, currentBranch, newBranch)
    }
  } catch (error) {
    tl.warning(`Failed to push quick fixes – ${(error as Error).message}`)
  }
}

async function gitPush(branch: string): Promise<void> {
  const output = await gitOutput(['push', 'origin', branch], {
    ignoreReturnCode: true
  })
  if (output.exitCode !== 0) {
    tl.warning(`Failed to push branch ${branch}: ${output.stderr}`)
  }
}

async function createPr(
  title: string,
  base: string,
  head: string
): Promise<void> {
  // in azure pull request needs refs/heads/
  if (!head.startsWith('refs/heads/')) {
    head = 'refs/heads/' + head
  }
  if (!base.startsWith('refs/heads/')) {
    base = 'refs/heads/' + base
  }
  const description = prFixesBody(getWorkflowRunUrl())
  const gitApi = await getGitApi()
  const project = getVariable('System.TeamProject')
  const repoId = getVariable('Build.Repository.Id')
  const pr: GitInterfaces.GitPullRequest = {
    sourceRefName: head,
    targetRefName: base,
    title: title,
    description: description
  }
  try {
    await gitApi.createPullRequest(pr, repoId, project)
  } catch (error) {
    tl.warning(
      `Failed to create pull request ${head} -> ${base}: ${(error as Error).message}`
    )
  }
}
