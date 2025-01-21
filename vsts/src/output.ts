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
import * as fs from 'fs'
import {
  getCoverageFromSarif,
  QODANA_LICENSES_JSON,
  QODANA_LICENSES_MD,
  QODANA_SARIF_NAME,
  QODANA_SHORT_SARIF_NAME
} from '../../common/qodana'
import {parseSarif, postResultsToPRComments, postSummary} from './utils'
import {
  getCoverageStats,
  getReportURL,
  getSummary,
  LicenseEntry,
  QODANA_CHECK_NAME
} from '../../common/output'

const DEPENDENCY_CHARS_LIMIT = 150000 // 150k chars is the Azure DevOps limit for a comment

/**
 * Publish Qodana results to Azure: comment, job summary.
 * @param projectDir The path to the project.
 * @param resultsDir The path to the results.
 * @param postComment whether to post a PR comment or not.
 * @param isPrMode
 * @param execute whether to execute the promise or not.
 * TODO param useAnnotations whether to publish annotations or not.
 */
export async function publishOutput(
  projectDir: string,
  resultsDir: string,
  postComment: boolean,
  isPrMode: boolean,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    const problems = parseSarif(`${resultsDir}/${QODANA_SARIF_NAME}`)
    const reportUrl = getReportURL(resultsDir)
    const coverageInfo = getCoverageStats(
      getCoverageFromSarif(`${resultsDir}/${QODANA_SHORT_SARIF_NAME}`)
    )

    let licensesInfo = ''
    let packages = 0
    const licensesJson = `${resultsDir}/projectStructure/${QODANA_LICENSES_JSON}`
    if (fs.existsSync(licensesJson)) {
      const licenses = JSON.parse(
        fs.readFileSync(licensesJson, {encoding: 'utf8'})
      ) as LicenseEntry[]
      if (licenses.length > 0) {
        packages = licenses.length
        licensesInfo = fs.readFileSync(
          `${resultsDir}/projectStructure/${QODANA_LICENSES_MD}`,
          {encoding: 'utf8'}
        )
      }
    }

    const problemsDescriptions = problems.problemDescriptions ?? []
    const toolName = problems.title.split('found by ')[1] ?? QODANA_CHECK_NAME
    problems.summary = getSummary(
      toolName,
      projectDir,
      problemsDescriptions,
      coverageInfo,
      packages,
      licensesInfo,
      reportUrl,
      isPrMode,
      DEPENDENCY_CHARS_LIMIT
    )

    postSummary(problems.summary)
    await postResultsToPRComments(toolName, problems.summary, postComment)
  } catch (error) {
    tl.warning(
      `Qodana has problems with publishing results to GitHub – ${
        (error as Error).message
      }`
    )
  }
}

// TODO delete after successful test
// export async function publishOutputTest(): Promise<void> {
//   try {
//     // Comment test
//     const orgUrl = getVariable('System.TeamFoundationCollectionUri')
//     const project = getVariable('System.TeamProject')
//     const repoId = getVariable('Build.Repository.Id')
//     const token = getVariable('System.AccessToken')
//     const pullRequestId = parseInt(
//       getVariable('System.PullRequest.PullRequestId'),
//       10
//     )
//     const tempDir = getVariable('Agent.TempDirectory') || ''
//
//     const authHandler = azdev.getPersonalAccessTokenHandler(token)
//     const webApi = new azdev.WebApi(orgUrl, authHandler)
//     const gitApi = await webApi.getGitApi()
//     const threads = await gitApi.getThreads(repoId, pullRequestId, project)
//     const comment: GitInterfaces.Comment = {
//       content: 'Test comment'
//     }
//     if (threads.length > 0) {
//       await gitApi.createComment(
//         comment,
//         repoId,
//         pullRequestId,
//         threads[0].id || 1,
//         project
//       )
//     } else {
//       const thread: GitInterfaces.GitPullRequestCommentThread = {
//         comments: [comment]
//       }
//       await gitApi.createThread(thread, repoId, pullRequestId, project)
//     }
//
//     // summary test
//     const filePath = path.join(tempDir, 'QodanaTaskSummary.md')
//     //fs.writeFileSync(filePath, getSummary())
//     //tl.addAttachment('markdown', 'Qodana Task Summary', filePath)
//     tl.uploadSummary(filePath)
//     tl.setResult(tl.TaskResult.Succeeded, 'Qodana scan completed')
//   } catch (error) {
//     tl.warning(
//       `Failed to make comment and add summary – ${(error as Error).message}`
//     )
//   }
// }
