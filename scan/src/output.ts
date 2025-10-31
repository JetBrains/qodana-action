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

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
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
  parseSarif as parseSarifCommon,
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

/**
 * Generates table rows from problem descriptors grouped by level.
 * @param problems The problem descriptors to generate table rows from.
 * @param level The level to filter by.
 * @param levelLabel The label to display for the level.
 */
function getRowsByLevelFromDescriptors(
  problems: ProblemDescriptor[],
  level: string,
  levelLabel: string
): string {
  const filteredProblems = problems.filter(p => p.level === level)
  if (filteredProblems.length === 0) {
    return ''
  }

  const problemMap = filteredProblems.reduce(
    (map: Map<string, number>, e) =>
      map.set(
        e.title ?? 'Unknown',
        map.get(e.title ?? 'Unknown') !== undefined
          ? map.get(e.title ?? 'Unknown')! + 1
          : 1
      ),
    new Map()
  )

  return Array.from(problemMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([title, count]) => `| \`${title}\` | ${levelLabel} | ${count} |`)
    .join('\n')
}

/**
 * Generates a markdown table from problem descriptors.
 * @param problems The problem descriptors to generate the table from.
 */
function generateProblemsTable(problems: ProblemDescriptor[]): string {
  if (problems.length === 0) {
    return ''
  }

  const header = '| Inspection name | Severity | Problems |'
  const separator = '| --- | --- | --- |'
  const rows = [
    getRowsByLevelFromDescriptors(problems, FAILURE_LEVEL, '🔴 Failure'),
    getRowsByLevelFromDescriptors(problems, WARNING_LEVEL, '🔶 Warning'),
    getRowsByLevelFromDescriptors(problems, NOTICE_LEVEL, '◽️ Notice')
  ]
    .filter(e => e !== '')
    .join('\n')

  if (rows === '') {
    return ''
  }

  return [header, separator, rows].join('\n')
}

interface OpenInIDEData {
  cloud?: {
    url?: string
  }
}

export interface InspectionMeta {
  description: string
  numberOfCurrentProblems: number
  numberOfFixedProblems: number
  commitInfo?: {
    commit: string
    description: string
  }
}

/*
 * The pull request with Edict extracted inspections body template.
 */
export function prEdictBody(
  resultsDir: string,
  jobUrl: string,
  inspectionMetas: Map<string, InspectionMeta>
): string {
  try {
    // Parse main SARIF report
    const mainSarifPath = path.join(resultsDir, 'qodana.sarif.json')
    const mainReport = parseSarifCommon(mainSarifPath, '')
    const mainReportUrl = getReportURL(resultsDir)

    // Parse fixed issues SARIF report
    const fixedSarifPath = path.join(
      resultsDir,
      'edict',
      'fixedIssuesReport',
      'qodana.sarif.json'
    )
    let fixedReport = {problemDescriptions: [] as ProblemDescriptor[]}
    let fixedReportUrl = ''
    let fixedCommitSha = ''

    if (fs.existsSync(fixedSarifPath)) {
      fixedReport = parseSarifCommon(fixedSarifPath, '')

      // Get commit SHA from SARIF metadata
      try {
        const fixedSarifContent = JSON.parse(
          fs.readFileSync(fixedSarifPath, 'utf8')
        ) as {
          runs?: {
            versionControlProvenance?: {revisionId?: string}[]
          }[]
        }
        fixedCommitSha =
          fixedSarifContent?.runs?.[0]?.versionControlProvenance?.[0]
            ?.revisionId || ''
      } catch {
        // Ignore if unable to read commit SHA
      }

      // Get fixed issues report URL from open-in-ide.json
      const fixedOpenInIdePath = path.join(
        resultsDir,
        'edict',
        'fixedIssuesReport',
        'open-in-ide.json'
      )
      if (fs.existsSync(fixedOpenInIdePath)) {
        const openInIdeData = JSON.parse(
          fs.readFileSync(fixedOpenInIdePath, 'utf8')
        ) as OpenInIDEData
        fixedReportUrl = openInIdeData?.cloud?.url || ''
      }
    }

    // Build the PR body
    let body = `# 🤖 Qodana Edict: Extracted Inspections

This pull request has been auto-generated by the [Qodana Scan workflow](${jobUrl}) with Edict analysis.

## 📊 Current Analysis Results

`

    if (mainReport.problemDescriptions.length > 0) {
      const mainTable = generateProblemsTable(mainReport.problemDescriptions)
      body += `**${mainReport.problemDescriptions.length} problem${mainReport.problemDescriptions.length !== 1 ? 's' : ''} found** in the current analysis:

${mainTable}
`
    } else {
      body += `**No problems found** in the current analysis.
`
    }

    if (mainReportUrl) {
      body += `
☁️ [View the detailed report](${mainReportUrl})
`
    }

    body += `
## ✅ Recently Fixed Issues

`

    if (fixedReport.problemDescriptions.length > 0) {
      const fixedTable = generateProblemsTable(fixedReport.problemDescriptions)
      const commitInfo = fixedCommitSha
        ? ` from commit \`${fixedCommitSha.substring(0, 8)}\``
        : ' in the last 6 months'
      body += `**${fixedReport.problemDescriptions.length} ${fixedReport.problemDescriptions.length !== 1 ? 'issues' : 'issue'} fixed**${commitInfo}:

${fixedTable}
`
    } else {
      body += `No recently fixed issues detected.
`
    }

    if (fixedReportUrl) {
      body += `
☁️ [View the fixed issues report](${fixedReportUrl})
`
    }

    body += `
## 📝 Extracted Inspections

This PR includes ${inspectionMetas.size} inspection file${inspectionMetas.size !== 1 ? 's' : ''} extracted by Qodana Edict in the \`inspections/\` directory.

`

    // Add details for each extracted inspection
    if (inspectionMetas.size > 0) {
      for (const [name, meta] of inspectionMetas) {
        body += `### ${name}

${meta.description}

- **Current problems**: ${meta.numberOfCurrentProblems}
- **Fixed problems**: ${meta.numberOfFixedProblems}

`
      }
    }

    body += `
> **Note**
> Please review the extracted inspections and the analysis results before merging this pull request.

_Best,
[Qodana Scan 🤖](https://github.com/marketplace/actions/qodana-scan)_`

    return body
  } catch (error) {
    core.warning(
      `Failed to generate Edict PR body – ${(error as Error).message}`
    )
    return `# 🤖 Qodana Edict: Extracted Inspections

This pull request has been auto-generated by the [Qodana Scan workflow](${jobUrl}) with Edict analysis.

The extracted inspection files are available in the \`inspections/\` directory.

_Best,
[Qodana Scan 🤖](https://github.com/marketplace/actions/qodana-scan)_`
  }
}
