/*
 * Copyright 2021-2024 JetBrains s.r.o.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
  uploadArtifacts,
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
    await uploadArtifacts(
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
