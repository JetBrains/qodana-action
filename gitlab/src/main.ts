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

    await Promise.all([
      prepareCaches(inputs.cacheDir, inputs.useCaches),
      prepareAgent(inputs)
    ])

    const exitCode = (await qodana()) as QodanaExitCode

    if (exitCode === QodanaExitCode.UnknownArgument) {
      console.warn(
        'Unknown argument was passed to the action. ' +
          'Please check available arguments in our documentation: https://github.com/JetBrains/qodana-cli#options-1. ' +
          'Note, that docker mode specific arguments not available for Linux because action already executed inside the container. ' +
          'Arguments: ',
        inputs.args,
        ''
      )
    }
    // uploadCache and uploadArtifacts store information inside project dir - don't want to commit them
    await pushQuickFixes(inputs.pushFixes, inputs.commitMessage)

    await Promise.all([
      publishOutput(
        extractArg('-i', '--project-dir', inputs.args),
        extractArg('-d', '--source-directory', inputs.args),
        inputs.resultsDir,
        inputs.postComment,
        inputs.prMode,
        isExecutionSuccessful(exitCode)
      ),
      uploadCache(inputs.cacheDir, inputs.useCaches),
      uploadArtifacts(inputs.resultsDir)
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

void main()
