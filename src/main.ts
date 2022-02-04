import * as core from '@actions/core'
import * as io from '@actions/io'
import {
  FAIL_THRESHOLD_OUTPUT,
  QODANA_SARIF_NAME,
  isExecutionSuccessful,
  isFailedByThreshold,
  restoreCaches,
  uploadCaches,
  uploadReport
} from './utils'
import {getQodanaScanArgs, prepareAgent, qodana} from './cli'
import {getInputs} from './context'
import {publishAnnotations} from './annotations'

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
  if (process.platform !== 'linux') {
    core.setFailed('Qodana Scan action is only supported on Linux runners')
    return
  }
  try {
    const inputs = getInputs()
    await Promise.all([
      io.mkdirP(inputs.resultsDir),
      io.mkdirP(inputs.cacheDir)
    ])
    await Promise.all([
      prepareAgent(inputs.args),
      restoreCaches(
        inputs.cacheDir,
        inputs.additionalCacheHash,
        inputs.useCaches
      )
    ])
    const cliExec = await qodana(getQodanaScanArgs(inputs))
    const failedByThreshold = isFailedByThreshold(cliExec.exitCode)
    await Promise.all([
      uploadReport(
        inputs.resultsDir,
        inputs.artifactName,
        inputs.uploadResults
      ),
      uploadCaches(
        inputs.cacheDir,
        inputs.additionalCacheHash,
        inputs.useCaches && isExecutionSuccessful(cliExec.exitCode)
      ),
      publishAnnotations(
        failedByThreshold,
        inputs.githubToken,
        `${inputs.resultsDir}/${QODANA_SARIF_NAME}`,
        inputs.useAnnotations && isExecutionSuccessful(cliExec.exitCode)
      )
    ])
    if (!isExecutionSuccessful(cliExec.exitCode)) {
      core.setFailed(cliExec.stderr.trim())
    } else if (failedByThreshold) {
      core.setFailed(FAIL_THRESHOLD_OUTPUT)
    }
  } catch (error) {
    core.setFailed((error as Error).message)
  }
}

// noinspection JSIgnoredPromiseFromCall
main()
