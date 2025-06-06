/*
 * Copyright 2021-2025 JetBrains s.r.o.
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
  getCoverageFromSarif,
  QODANA_SARIF_NAME,
  QODANA_SHORT_SARIF_NAME,
  VERSION
} from '../../common/qodana'
import {getWorkflowRunUrl, postResultsToPRComments, postSummary} from './utils'
import {
  getCoverageStats,
  getLicenseInfo,
  getReportURL,
  getSummary,
  parseSarif,
  QODANA_CHECK_NAME
} from '../../common/output'

export const DEPENDENCY_CHARS_LIMIT = 150000 // 150k chars is the Azure DevOps limit for a comment
export const VIEW_REPORT_OPTIONS = `To be able to view the detailed Qodana report, you can either:
  - Register at [Qodana Cloud](https://qodana.cloud/) and [configure the task](https://www.jetbrains.com/help/qodana/qodana-azure-pipelines.html#Qodana+Cloud)
  - Use [SARIF SAST Scans Tab](https://marketplace.visualstudio.com/items?itemName=sariftools.scans) extension to display report summary in Azure DevOps UI in 'Scans' tab
  - Inspect and use \`qodana.sarif.json\` (see [the Qodana SARIF format](https://www.jetbrains.com/help/qodana/qodana-sarif-output.html#Report+structure) for details)

To get \`*.log\` files or any other Qodana artifacts, run the task with \`uploadResult\` option set to \`true\`, 
so that the action will upload the files as the job artifacts:
\`\`\`yaml
        - task: QodanaScan@${VERSION}
          inputs:
            uploadResult: true
\`\`\`
`

export function getQodanaHelpString(): string {
  return `This result was published with [Qodana Task](<${getWorkflowRunUrl()}>)`
}

/**
 * Publish Qodana results to Azure: comment, job summary.
 * @param projectDir The path to the project.
 * @param sourceDir The path to the analyzed directory inside the project.
 * @param resultsDir The path to the results.
 * @param postComment whether to post a PR comment or not.
 * @param isPrMode
 * @param execute whether to execute the promise or not.
 */
export async function publishOutput(
  projectDir: string,
  sourceDir: string,
  resultsDir: string,
  postComment: boolean,
  isPrMode: boolean,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    const problems = parseSarif(
      `${resultsDir}/${QODANA_SARIF_NAME}`,
      getQodanaHelpString()
    )
    const reportUrl = getReportURL(resultsDir)
    const coverageInfo = getCoverageStats(
      getCoverageFromSarif(`${resultsDir}/${QODANA_SHORT_SARIF_NAME}`),
      false
    )

    const licensesInfo = getLicenseInfo(resultsDir)

    const problemsDescriptions = problems.problemDescriptions ?? []
    const toolName = problems.title.split('found by ')[1] ?? QODANA_CHECK_NAME
    problems.summary = getSummary(
      toolName,
      projectDir,
      sourceDir,
      problemsDescriptions,
      coverageInfo,
      licensesInfo.packages,
      licensesInfo.licenses,
      reportUrl,
      isPrMode,
      DEPENDENCY_CHARS_LIMIT,
      VIEW_REPORT_OPTIONS
    )

    postSummary(problems.summary)
    await postResultsToPRComments(
      toolName,
      sourceDir,
      problems.summary,
      problemsDescriptions.length != 0,
      postComment
    )
  } catch (error) {
    tl.warning(
      `Qodana has problems with publishing results to Azure – ${
        (error as Error).message
      }`
    )
  }
}

/*
 * The pull request with quick-fixes body template.
 */
export function prFixesBody(jobUrl: string): string {
  return ` 🖐 Hey there!

This pull request has been auto-generated by the [Qodana Scan task](<${jobUrl}>) configured in your repository.
It has performed code analysis and applied some suggested fixes to improve your code quality 🧹✨

> **Warning**
>  It's crucial to review these changes to ensure everything shipshape manually. Please take a moment to examine the changes here. Remember to run your integration tests against this PR to validate the fixes and ensure everything's functioning as expected.

_💻🔍 Happy reviewing and testing!
Best,
[Qodana Scan 🤖](https://marketplace.visualstudio.com/items?itemName=JetBrains.qodana)_`
}
