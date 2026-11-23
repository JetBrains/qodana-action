import * as fs from 'fs'
import {
  discardCache,
  getInputs,
  prepareAgent,
  prepareCaches,
  pushQuickFixes,
  qodanaScan,
  uploadArtifacts,
  uploadCache
} from './utils'
import {
  extractArg,
  FAIL_THRESHOLD_OUTPUT,
  isExecutionSuccessful,
  QodanaExitCode
} from '../../common/qodana'
import {publishOutput} from './output'

function setFailed(message: string, exitCode: number): void {
  console.error(message)
  process.exit(exitCode)
}

async function main(): Promise<void> {
  const inputs = getInputs()
  try {
    fs.mkdirSync(inputs.resultsDir, {recursive: true})
    fs.mkdirSync(inputs.cacheDir, {recursive: true})
    prepareCaches(inputs.cacheDir, inputs.useCaches)
    await prepareAgent(inputs.nightlyVersion, inputs.useInstalledCli)

    const exitCode = (await qodanaScan()) as QodanaExitCode

    await Promise.all([
      publishOutput(
        extractArg('-i', '--project-dir', inputs.args),
        extractArg('-d', '--source-directory', inputs.args),
        inputs.resultsDir,
        inputs.postComment,
        inputs.prMode,
        isExecutionSuccessful(exitCode)
      ),
      pushQuickFixes(inputs.pushFixes, inputs.commitMessage)
    ])

    // after pushQuickFixes, which commits everything in the project;
    // a failed quality gate still means a complete scan, so its cache is kept
    if (isExecutionSuccessful(exitCode)) {
      uploadCache(inputs.cacheDir, inputs.useCaches)
    } else {
      discardCache(inputs.cacheDir, inputs.useCaches)
    }
    uploadArtifacts(inputs.resultsDir)
    if (!isExecutionSuccessful(exitCode)) {
      setFailed(`qodana scan failed with exit code ${exitCode}`, exitCode)
    } else if (exitCode === QodanaExitCode.FailThreshold) {
      setFailed(FAIL_THRESHOLD_OUTPUT, exitCode)
    }
  } catch (error) {
    // uphold contract: if we manage cache, if we sure cahces are correct - keep them, if they are not sure -
    // don't upload them by removing the directory where GitLab expects caches
    discardCache(inputs.cacheDir, inputs.useCaches)
    setFailed((error as Error).message, 1)
  }
}

// getInputs fails on invalid inputs, before there is a cache to handle
main().catch((error: Error) => setFailed(error.message, 1))
