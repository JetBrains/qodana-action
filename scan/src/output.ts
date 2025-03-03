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

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as core from '@actions/core'
import {
  getCoverageFromSarif,
  QODANA_SARIF_NAME,
  QODANA_SHORT_SARIF_NAME,
  VERSION
} from '../../common/qodana'
import {
  ANALYSIS_FINISHED_REACTION,
  ANALYSIS_STARTED_REACTION,
  postResultsToPRComments,
  putReaction
} from './utils'
import {
  Annotation,
  ANNOTATION_FAILURE,
  ANNOTATION_WARNING,
  parseSarif,
  publishAnnotations
} from './annotations'
import {
  FAILURE_LEVEL,
  getCoverageStats,
  getLicenseInfo,
  getReportURL,
  getSummary,
  LicenseInfo,
  NOTICE_LEVEL,
  ProblemDescriptor,
  QODANA_CHECK_NAME,
  WARNING_LEVEL
} from '../../common/output'

export const DEPENDENCY_CHARS_LIMIT = 65000 // 65k chars is the GitHub limit for a comment
export const VIEW_REPORT_OPTIONS = `To be able to view the detailed Qodana report, you can either:
  - Register at [Qodana Cloud](https://qodana.cloud/) and [configure the action](https://github.com/jetbrains/qodana-action#qodana-cloud)
  - Use [GitHub Code Scanning with Qodana](https://github.com/jetbrains/qodana-action#github-code-scanning)
  - Host [Qodana report at GitHub Pages](https://github.com/JetBrains/qodana-action/blob/3a8e25f5caad8d8b01c1435f1ef7b19fe8b039a0/README.md#github-pages)
  - Inspect and use \`qodana.sarif.json\` (see [the Qodana SARIF format](https://www.jetbrains.com/help/qodana/qodana-sarif-output.html#Report+structure) for details)

To get \`*.log\` files or any other Qodana artifacts, run the action with \`upload-result\` option set to \`true\`, 
so that the action will upload the files as the job artifacts:
\`\`\`yaml
      - name: 'Qodana Scan'
        uses: JetBrains/qodana-action@v${VERSION}
        with:
          upload-result: true
\`\`\`
`

/**
 * Publish Qodana results to GitHub: comment, job summary, annotations.
 * @param failedByThreshold flag if the Qodana failThreshold was reached.
 * @param projectDir The path to the project.
 * @param sourceDir The path to the analyzed directory inside the project.
 * @param resultsDir The path to the results.
 * @param postComment whether to post a PR comment or not.
 * @param isPrMode
 * @param execute whether to execute the promise or not.
 * @param useAnnotations whether to publish annotations or not.
 */
export async function publishOutput(
  failedByThreshold: boolean,
  projectDir: string,
  sourceDir: string,
  resultsDir: string,
  useAnnotations: boolean,
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
      getCoverageFromSarif(`${resultsDir}/${QODANA_SHORT_SARIF_NAME}`),
      true
    )

    const licensesInfo: LicenseInfo = getLicenseInfo(resultsDir)

    const problemsDescriptions = annotationsToProblemDescriptors(
      problems.annotations
    )
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
    // source dir is needed for project distinction in monorepo
    const jobName = `${toolName}` + (sourceDir === '' ? '' : ` (${sourceDir})`)
    await Promise.all([
      putReaction(ANALYSIS_FINISHED_REACTION, ANALYSIS_STARTED_REACTION),
      postResultsToPRComments(
        toolName,
        problems.summary,
        sourceDir,
        postComment
      ),
      core.summary.addRaw(problems.summary).write(),
      publishAnnotations(jobName, problems, failedByThreshold, useAnnotations)
    ])
  } catch (error) {
    core.warning(
      `Qodana has problems with publishing results to GitHub – ${
        (error as Error).message
      }`
    )
  }
}

export function annotationsToProblemDescriptors(
  annotations: Annotation[] | undefined
): ProblemDescriptor[] {
  return (
    annotations?.map(annotation => {
      return {
        title: annotation.title,
        level: (() => {
          switch (annotation.annotation_level) {
            case ANNOTATION_FAILURE:
              return FAILURE_LEVEL
            case ANNOTATION_WARNING:
              return WARNING_LEVEL
            default:
              return NOTICE_LEVEL
          }
        })()
      }
    }) ?? []
  )
}

/*
 * The pull request with quick-fixes body template.
 */
export function prFixesBody(jobUrl: string): string {
  return ` 🖐 Hey there!

This pull request has been auto-generated by the [Qodana Scan workflow](${jobUrl}) configured in your repository.
It has performed code analysis and applied some suggested fixes to improve your code quality 🧹✨

> **Warning**
>  It's crucial to review these changes to ensure everything shipshape manually. Please take a moment to examine the changes here. Remember to run your integration tests against this PR to validate the fixes and ensure everything's functioning as expected.

_💻🔍 Happy reviewing and testing!
Best,
[Qodana Scan 🤖](https://github.com/marketplace/actions/qodana-scan)_`
}
