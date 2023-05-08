import * as core from '@actions/core'
import * as github from '@actions/github'
import * as io from '@actions/io'
import {
  FAIL_THRESHOLD_OUTPUT,
  QodanaExitCode,
  isExecutionSuccessful
} from '../../common/qodana'
import {
  getInputs,
  isNeedToUploadCache,
  prepareAgent,
  qodana,
  restoreCaches,
  uploadCaches,
  uploadReport
} from './utils'
import {publishOutput} from './output'

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on('uncaughtException', e => core.warning(e.message))

function setFailed(message: string): void {
  core.setFailed(message)
}

/**
 * Main Qodana GitHub Action entrypoint.
 * - gathers all action inputs
 * - loads caches
 * - creates the directories for Qodana results to ensure the correct permissions
 * - runs the Qodana image
 * - uploads the report as the job artifact
 * - saves caches
 * - uploads action annotations
 * Every step except the Qodana image run is optional.
 */
async function main(): Promise<void> {
  try {
    const inputs = getInputs()
    await io.mkdirP(inputs.resultsDir)
    await io.mkdirP(inputs.cacheDir)
    await Promise.all([
      prepareAgent(inputs.args),
      restoreCaches(
        inputs.cacheDir,
        inputs.primaryCacheKey,
        inputs.additionalCacheKey,
        inputs.useCaches
      )
    ])
    const pr =
      github.context.payload.pull_request !== undefined && inputs.prMode
    const exitCode = await qodana(pr)
    const canUploadCache =
      isNeedToUploadCache(inputs.useCaches, inputs.cacheDefaultBranchOnly) &&
      isExecutionSuccessful(exitCode)

    await Promise.all([
      uploadReport(inputs.resultsDir, inputs.artifactName, inputs.uploadResult),
      uploadCaches(inputs.cacheDir, inputs.primaryCacheKey, canUploadCache),
      publishOutput(
        exitCode === QodanaExitCode.FailThreshold,
        inputs.resultsDir,
        inputs.useAnnotations,
        pr,
        isExecutionSuccessful(exitCode)
      )
    ])
    if (!isExecutionSuccessful(exitCode)) {
      setFailed(`qodana scan failed with exit code ${exitCode}`)
    } else if (exitCode === QodanaExitCode.FailThreshold) {
      setFailed(FAIL_THRESHOLD_OUTPUT)
    }
  } catch (error) {
    setFailed((error as Error).message)
  }
}

// noinspection JSIgnoredPromiseFromCall
main()
