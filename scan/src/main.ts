import * as core from '@actions/core'
import * as github from '@actions/github'
import * as io from '@actions/io'
import {
  FAIL_THRESHOLD_OUTPUT,
  QodanaExitCode,
  isExecutionSuccessful,
  NONE
} from '../../common/qodana'
import {
  ANALYSIS_FINISHED_REACTION,
  ANALYSIS_STARTED_REACTION,
  getInputs,
  isNeedToUploadCache,
  prepareAgent,
  putReaction,
  qodana,
  restoreCaches,
  uploadCaches,
  uploadArtifacts,
  pushQuickFixes
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
    if (
      inputs.pushFixes !== NONE &&
      inputs.prMode &&
      github.context.payload.pull_request !== undefined
    ) {
      inputs.pushFixes = NONE
      core.warning(
        `push-fixes is currently not supported with pr-mode: true in pull requests. Running Qodana with push-fixes: ${inputs.pushFixes}.`
      )
    }
    await io.mkdirP(inputs.resultsDir)
    await io.mkdirP(inputs.cacheDir)

    const restoreCachesPromise = restoreCaches(
      inputs.cacheDir,
      inputs.primaryCacheKey,
      inputs.additionalCacheKey,
      inputs.useCaches
    )
    await Promise.all([
      putReaction(ANALYSIS_STARTED_REACTION, ANALYSIS_FINISHED_REACTION),
      prepareAgent(inputs.args, inputs.useNightly),
      restoreCachesPromise
    ])
    const reservedCacheKey = await restoreCachesPromise
    const exitCode = await qodana(inputs)
    const canUploadCache =
      isNeedToUploadCache(inputs.useCaches, inputs.cacheDefaultBranchOnly) &&
      isExecutionSuccessful(exitCode)

    await Promise.all([
      pushQuickFixes(inputs.pushFixes, inputs.commitMessage),
      uploadArtifacts(
        inputs.resultsDir,
        inputs.artifactName,
        inputs.uploadResult
      ),
      uploadCaches(
        inputs.cacheDir,
        inputs.primaryCacheKey,
        reservedCacheKey,
        canUploadCache
      ),
      publishOutput(
        exitCode === QodanaExitCode.FailThreshold,
        inputs.resultsDir,
        inputs.useAnnotations,
        inputs.postComment,
        inputs.prMode,
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
