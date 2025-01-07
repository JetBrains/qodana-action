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

import * as tl from 'azure-pipelines-task-lib/task'
import * as tool from 'azure-pipelines-tool-lib'
import {
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
  sha256sum,
  VERSION
} from '../../common/qodana'

// eslint-disable-next-line @typescript-eslint/no-require-imports
import path = require('path')
import {IExecOptions} from 'azure-pipelines-task-lib/toolrunner'
import {Writable} from 'node:stream'

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
    // Not used by the Azure task
    postComment: false,
    additionalCacheKey: '',
    primaryCacheKey: '',
    useAnnotations: false,
    useCaches: false,
    cacheDefaultBranchOnly: false,
    githubToken: '',
    pushFixes: 'none',
    commitMessage: ''
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
  tool.prependPath(
    await tool.cacheDir(
      extractRoot,
      EXECUTABLE,
      useNightly ? 'nightly' : VERSION
    )
  )
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
      const lines = output.stdout.trim().split('\n')
      if (lines.length > 1) {
        return lines[1].trim()
      }
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

  result.exitCode = await tl.execAsync('git', args, options)
  return result
}
