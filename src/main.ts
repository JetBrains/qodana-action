import * as core from '@actions/core'
import * as io from '@actions/io'
import {docker, getQodanaRunArgs} from './docker'
import {restoreCaches, uploadCaches, uploadReport} from './utils'
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
    const inputs = getInputs()

    await io.mkdirP(inputs.cacheDir)
    await io.mkdirP(inputs.resultsDir)

    if (inputs.useCaches) {
      await restoreCaches(inputs.cacheDir)
    }

    const args = getQodanaRunArgs(inputs)
    const dockerExec = await docker(args)

    if (inputs.uploadResults) {
      await uploadReport(inputs.resultsDir)
    }
    if (inputs.useCaches) {
      await uploadCaches(inputs.cacheDir)
    }

    if (dockerExec.stderr.length > 0 && dockerExec.exitCode !== 0) {
      core.setFailed(dockerExec.stderr.trim())
    } else {
      if (inputs.useAnnotations) {
        await publishAnnotations(
          inputs.githubToken,
          `${inputs.resultsDir}/qodana.sarif.json`
        )
      }
    }
  } catch (error) {
    core.setFailed((error as Error).message)
  }
}

// noinspection JSIgnoredPromiseFromCall
main()
