/*
 * Copyright 2021-2026 JetBrains s.r.o.
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
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import path from 'path'
import {
  EXECUTABLE,
  extractArg,
  Inputs,
  QODANA_SARIF_NAME
} from '../../common/qodana'

/** The start of every warning about Edict feedback, worded as the CLI words its own. */
export const EDICT_FEEDBACK_UNAVAILABLE =
  'Edict promotion comments are unavailable'

/**
 * The property that makes Qodana run the inspections of a directory without reporting their findings. It names the
 * directory on the host: the CLI, which knows whether the analysis runs in a container, mounts it there.
 */
const INSPECTIONS_DIR_PROPERTY = 'qodana.internal.inspections.kts.dir'

/**
 * Runs `qodana edict feedback prepare`, which copies the Edict inspections whose findings may become review comments
 * into the inspections directory, or none when the run gets no feedback.
 * @param inputs the action inputs.
 */
export async function prepareEdictFeedback(inputs: Inputs): Promise<void> {
  // the scan mounts the directory, which Docker refuses when it is missing
  await io.mkdirP(inputs.edictInspectionsDir)
  await edictFeedback(inputs.args, 'prepare', [
    '--state-dir',
    inputs.edictStateDir,
    '--output-dir',
    inputs.edictInspectionsDir
  ])
}

/**
 * Adds to the scan arguments [scanArgs] what makes the scan run the inspections of the inspections directory.
 * @param scanArgs the `qodana scan` arguments to add to.
 * @param inputs the action inputs.
 */
export function addEdictParams(scanArgs: string[], inputs: Inputs): void {
  if (!inputs.enableEdictFeedback) {
    return
  }
  scanArgs.push(
    '--property',
    `${INSPECTIONS_DIR_PROPERTY}=${inputs.edictInspectionsDir}`
  )
}

/**
 * Runs `qodana edict feedback post`, which comments on the pull request with findings of the scan's Edict inspections.
 * @param inputs the action inputs.
 * @param published whether the action published the scan results to the pull request: a token that cannot write the
 * summary comment cannot write review comments either.
 */
export async function postEdictFeedback(
  inputs: Inputs,
  published: boolean
): Promise<void> {
  if (!published) {
    core.warning(
      `${EDICT_FEEDBACK_UNAVAILABLE}: Qodana could not publish its results to the pull request`
    )
    return
  }
  await edictFeedback(
    inputs.args,
    'post',
    [
      '--state-dir',
      inputs.edictStateDir,
      '--sarif',
      path.resolve(inputs.resultsDir, QODANA_SARIF_NAME)
    ],
    {...process.env, GITHUB_TOKEN: inputs.githubToken}
  )
}

/**
 * Runs `qodana edict feedback <command>` in the project directory with the scan's configuration file.
 * @param env the environment of the command, the action's own by default.
 * A failure is a warning, never a failure of the action.
 */
async function edictFeedback(
  args: string[],
  command: string,
  commandArgs: string[],
  env?: exec.ExecOptions['env']
): Promise<void> {
  const config = extractArg('--config', '--config', args)
  const projectDir = extractArg('-i', '--project-dir', args)
  try {
    const {exitCode} = await exec.getExecOutput(
      EXECUTABLE,
      [
        'edict',
        'feedback',
        command,
        ...commandArgs,
        ...(config ? ['--config', config] : [])
      ],
      {ignoreReturnCode: true, cwd: projectDir || undefined, env}
    )
    if (exitCode !== 0) {
      core.warning(
        `${EDICT_FEEDBACK_UNAVAILABLE}: qodana edict feedback ${command} failed with exit code ${exitCode}`
      )
    }
  } catch (error) {
    core.warning(
      `${EDICT_FEEDBACK_UNAVAILABLE}: qodana edict feedback ${command} failed – ${(error as Error).message}`
    )
  }
}
