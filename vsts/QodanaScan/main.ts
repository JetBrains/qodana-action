import * as compress from 'azure-pipelines-tasks-utility-common/compressutility'
import * as tl from 'azure-pipelines-task-lib/task'
import * as tool from 'azure-pipelines-tool-lib'
import {
  EXECUTABLE,
  extractArgsLinter,
  FAIL_THRESHOLD_OUTPUT,
  getQodanaCliUrl,
  getQodanaScanArgs,
  Inputs, isExecutionSuccessful,
  isFailedByThreshold,
  VERSION
} from '@qodana/ci-common'
// eslint-disable-next-line @typescript-eslint/no-require-imports
import path = require('path')

// Catch and log any unhandled exceptions. These exceptions can leak out in
// azure-pipelines-task-lib when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on('uncaughtException', e => tl.warning(e.message))

function setFailed(message: string): void {
  tl.setResult(tl.TaskResult.Failed, message)
}

/**
 * The context for the task.
 * @returns The Azure DevOps Pipeline inputs.
 */
export function getInputs(): Inputs {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const home = path.join(process.env['AGENT_TEMPDIRECTORY']!!, 'qodana')
  return {
    args: (tl.getInput('args', false) || '').split(','),
    resultsDir: tl.getInput('resultsDir', false) || path.join(home, 'results'),
    cacheDir: tl.getInput('cacheDir', false) || path.join(home, 'cache'),
    uploadResults: tl.getBoolInput('uploadResults', false) || true,
    artifactName: tl.getInput('artifactName', false) || 'qodana-report',
    // Not used by the task
    additionalCacheHash: '',
    githubToken: '',
    useAnnotations: false,
    useCaches: false
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
    args = getQodanaScanArgs(inputs)
  }
  return tl.exec(EXECUTABLE, args, {
    ignoreReturnCode: true
  })
}

/**
 * Prepares the agent for qodana scan: install Qodana CLI and pull the linter.
 * @param args qodana arguments
 */
export async function prepareAgent(args: string[]): Promise<void> {
  const temp = await tool.downloadTool(getQodanaCliUrl())
  let extractRoot
  if (process.platform === 'win32') {
    extractRoot = await tool.extractZip(temp)
  } else {
    extractRoot = await tool.extractTar(temp)
  }
  tool.prependPath(await tool.cacheDir(extractRoot, EXECUTABLE, VERSION))
  const pullArgs = ['pull']
  const linter = extractArgsLinter(args)
  if (linter) {
    pullArgs.push('-l', linter)
  }
  const pull = await qodana(pullArgs)
  if (pull !== 0) {
    tl.setResult(tl.TaskResult.Failed, "Unable to run 'qodana pull'")
    return
  }
}

/**
 * Uploads the Qodana report files from temp directory to Azure DevOps Pipelines job artifact.
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
    const parentDir = path.dirname(resultsDir)
    const archivePath = path.join(parentDir, `${artifactName}.zip`)
    compress.createArchive(resultsDir, 'zip', archivePath)
    tl.uploadArtifact('Qodana', archivePath, artifactName)
    const qodanaSarif = path.join(parentDir, 'qodana.sarif')
    tl.cp(path.join(resultsDir, 'qodana.sarif.json'), qodanaSarif)
    tl.uploadArtifact('CodeAnalysisLogs', qodanaSarif, 'CodeAnalysisLogs')
  } catch (error) {
    tl.warning(`Failed to upload report – ${(error as Error).message}`)
  }
}

async function main(): Promise<void> {
  try {
    const inputs = getInputs()
    tl.mkdirP(inputs.resultsDir)
    tl.mkdirP(inputs.cacheDir)
    await Promise.all([prepareAgent(inputs.args)])
    const exitCode = await qodana()
    const failedByThreshold = isFailedByThreshold(exitCode)
    await Promise.all([
      uploadReport(inputs.resultsDir, inputs.artifactName, inputs.uploadResults)
    ])
    if (!isExecutionSuccessful(exitCode)) {
      setFailed(`qodana scan failed with exit code ${exitCode}`)
    } else if (failedByThreshold) {
      setFailed(FAIL_THRESHOLD_OUTPUT)
    }
  } catch (error) {
    setFailed((error as Error).message)
  }
}

// noinspection JSIgnoredPromiseFromCall
main()
