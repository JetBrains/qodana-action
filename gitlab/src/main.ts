import * as fs from 'fs'
import {
  getInputs,
  prepareAgent,
  prepareCaches,
  pushQuickFixes,
  qodana,
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

function setFailed(message: string): void {
  console.error(message)
  throw new Error(message)
}

async function main(): Promise<void> {
  try {
    const inputs = getInputs()
    fs.mkdirSync(inputs.resultsDir, {recursive: true})
    fs.mkdirSync(inputs.cacheDir, {recursive: true})
    prepareCaches(inputs.cacheDir)
    await prepareAgent(inputs, inputs.useNightly)

    const exitCode = (await qodana()) as QodanaExitCode

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

    uploadCache(inputs.cacheDir, inputs.useCaches)
    uploadArtifacts(inputs.resultsDir, inputs.uploadResult)
    if (!isExecutionSuccessful(exitCode)) {
      setFailed(`qodana scan failed with exit code ${exitCode}`)
    } else if (exitCode === QodanaExitCode.FailThreshold) {
      setFailed(FAIL_THRESHOLD_OUTPUT)
    }
  } catch (error) {
    setFailed((error as Error).message)
  }
}

void main()
