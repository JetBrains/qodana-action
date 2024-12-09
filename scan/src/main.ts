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

import * as core from '@actions/core'
import * as github from '@actions/github'
import * as io from '@actions/io'
import {
  FAIL_THRESHOLD_OUTPUT,
  QodanaExitCode,
  isExecutionSuccessful,
  NONE,
  extractArg
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
    await io.mkdirP(inputs.resultsDir)
    await io.mkdirP(inputs.cacheDir)

    // just some random comment
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
        extractArg('-i', '--project-dir', inputs.args),
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
