import * as core from '@actions/core'
import * as io from '@actions/io'
import {
  FAIL_THRESHOLD_OUTPUT,
  isExecutionSuccessful,
  isFailedByThreshold,
  restoreCaches,
  uploadCaches,
  uploadReport,
  validateContext
} from './utils'
import {docker, getQodanaRunArgs} from './docker'
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
  try {
    const inputs = validateContext(getInputs())

    await io.mkdirP(inputs.cacheDir)
    await io.mkdirP(inputs.resultsDir)

    if (inputs.useCaches) {
      await restoreCaches(inputs.cacheDir)
    }

    const args = getQodanaRunArgs(inputs)

    const dockerPull = await docker(['pull', inputs.linter])
    if (dockerPull.stderr.length > 0 && dockerPull.exitCode !== 0) {
      core.setFailed(dockerPull.stderr.trim())
      return
    }

    const dockerExec = await docker(args)

    if (inputs.uploadResults) {
      await uploadReport(inputs.resultsDir)
    }

    const failedByThreshold = isFailedByThreshold(dockerExec.exitCode)
    if (isExecutionSuccessful(dockerExec.exitCode)) {
      if (inputs.useCaches) {
        await uploadCaches(inputs.cacheDir)
      }

      if (inputs.useAnnotations) {
        await publishAnnotations(
          failedByThreshold,
          inputs.githubToken,
          `${inputs.resultsDir}/qodana.sarif.json`
        )
      }

      if (failedByThreshold) core.setFailed(FAIL_THRESHOLD_OUTPUT)
    } else {
      core.setFailed(dockerExec.stderr.trim())
    }
  } catch (error) {
    core.setFailed((error as Error).message)
  }
}

// noinspection JSIgnoredPromiseFromCall
main()
