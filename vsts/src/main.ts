import * as tl from 'azure-pipelines-task-lib/task'
import {
  FAIL_THRESHOLD_OUTPUT,
  QodanaExitCode,
  isExecutionSuccessful
} from '../../common/qodana'
import {
  getInputs,
  prepareAgent,
  qodana,
  setFailed,
  uploadReport,
  uploadSarif
} from './utils'

// Catch and log any unhandled exceptions. These exceptions can leak out in
// azure-pipelines-task-lib when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on('uncaughtException', e => tl.warning(e.message))

async function main(): Promise<void> {
  try {
    const inputs = getInputs()
    tl.mkdirP(inputs.resultsDir)
    tl.mkdirP(inputs.cacheDir)
    await prepareAgent(inputs.args)
    const exitCode = await qodana()
    await uploadReport(
      inputs.resultsDir,
      inputs.artifactName,
      inputs.uploadResult
    )
    await uploadSarif(inputs.resultsDir, inputs.uploadSarif)
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
