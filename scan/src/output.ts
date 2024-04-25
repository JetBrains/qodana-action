/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as core from '@actions/core'
import * as fs from 'fs'
import {
  Coverage,
  COVERAGE_THRESHOLD,
  getCoverageFromSarif,
  QODANA_LICENSES_JSON,
  QODANA_LICENSES_MD,
  QODANA_OPEN_IN_IDE_NAME,
  QODANA_REPORT_URL_NAME,
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
  ANNOTATION_NOTICE,
  ANNOTATION_WARNING,
  parseSarif,
  publishAnnotations
} from './annotations'

export const COMMIT_USER = 'qodana-bot'
export const COMMIT_EMAIL = 'qodana-support@jetbrains.com'
const QODANA_CHECK_NAME = 'Qodana'
const UNKNOWN_RULE_ID = 'Unknown'
const SUMMARY_TABLE_HEADER = '| Inspection name | Severity | Problems |'
const SUMMARY_TABLE_SEP = '| --- | --- | --- |'
const SUMMARY_MISC = `Contact us at [qodana-support@jetbrains.com](mailto:qodana-support@jetbrains.com)
  - Or via our issue tracker: https://jb.gg/qodana-issue
  - Or share your feedback: https://jb.gg/qodana-discussions`
const VIEW_REPORT_OPTIONS = `To be able to view the detailed Qodana report, you can either:
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
const SUMMARY_PR_MODE = `💡 Qodana analysis was run in the pull request mode: only the changed files were checked`

function wrapToDiffBlock(message: string): string {
  return `\`\`\`diff
${message}
\`\`\``
}

export function getCoverageStats(c: Coverage, threshold: number): string {
  if (c.totalLines === 0 && c.totalCoveredLines === 0) {
    return ''
  }

  let stats = ''
  if (c.totalLines !== 0) {
    let conclusion = `${c.totalCoverage}% total lines covered`
    if (c.totalCoverage < threshold) {
      conclusion = `- ${conclusion}`
    } else {
      conclusion = `+ ${conclusion}`
    }
    stats += `${conclusion}
${c.totalLines} lines analyzed, ${c.totalCoveredLines} lines covered`
  }

  if (c.freshLines !== 0) {
    stats += `
! ${c.freshCoverage}% fresh lines covered
${c.freshLines} lines analyzed, ${c.freshCoveredLines} lines covered`
  }

  return wrapToDiffBlock(
    [
      `@@ Code coverage @@`,
      `${stats}`,
      `# Calculated according to the filters of your coverage tool`
    ].join('\n')
  )
}

export function getReportURL(resultsDir: string): string {
  let reportUrlFile = `${resultsDir}/${QODANA_OPEN_IN_IDE_NAME}`
  if (fs.existsSync(reportUrlFile)) {
    const data = JSON.parse(fs.readFileSync(reportUrlFile, {encoding: 'utf8'}))
    if (data && data.cloud && data.cloud.url) {
      return data.cloud.url
    }
  } else {
    reportUrlFile = `${resultsDir}/${QODANA_REPORT_URL_NAME}`
    if (fs.existsSync(reportUrlFile)) {
      return fs.readFileSync(`${resultsDir}/${QODANA_REPORT_URL_NAME}`, {
        encoding: 'utf8'
      })
    }
  }
  return ''
}

/**
 * Publish Qodana results to GitHub: comment, job summary, annotations.
 * @param failedByThreshold flag if the Qodana failThreshold was reached.
 * @param resultsDir The path to the results.
 * @param postComment whether to post a PR comment or not.
 * @param isPrMode
 * @param execute whether to execute the promise or not.
 * @param useAnnotations whether to publish annotations or not.
 */
export async function publishOutput(
  failedByThreshold: boolean,
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
      COVERAGE_THRESHOLD
    )
    let licensesInfo = ''
    let packages = 0
    const licensesJson = `${resultsDir}/projectStructure/${QODANA_LICENSES_JSON}`
    if (fs.existsSync(licensesJson)) {
      const licenses = JSON.parse(
        fs.readFileSync(licensesJson, {encoding: 'utf8'})
      )
      if (licenses.length > 0) {
        packages = licenses.length
        licensesInfo = fs.readFileSync(
          `${resultsDir}/projectStructure/${QODANA_LICENSES_MD}`,
          {encoding: 'utf8'}
        )
      }
    }

    const annotations: Annotation[] = problems.annotations ?? []
    const toolName = problems.title.split('found by ')[1] ?? QODANA_CHECK_NAME
    problems.summary = getSummary(
      toolName,
      annotations,
      coverageInfo,
      packages,
      licensesInfo,
      reportUrl,
      isPrMode
    )

    await Promise.all([
      putReaction(ANALYSIS_FINISHED_REACTION, ANALYSIS_STARTED_REACTION),
      postResultsToPRComments(toolName, problems.summary, postComment),
      core.summary.addRaw(problems.summary).write(),
      publishAnnotations(toolName, problems, failedByThreshold, useAnnotations)
    ])
  } catch (error) {
    core.warning(
      `Qodana has problems with publishing results to GitHub – ${
        (error as Error).message
      }`
    )
  }
}

function wrapToToggleBlock(header: string, body: string): string {
  return `<details>
<summary>${header}</summary>

${body}
</details>`
}

function getViewReportText(reportUrl: string): string {
  if (reportUrl !== '') {
    return `☁️ [View the detailed Qodana report](${reportUrl})`
  }
  return wrapToToggleBlock(
    'View the detailed Qodana report',
    VIEW_REPORT_OPTIONS
  )
}

/**
 * Generates a table row for a given level.
 * @param annotations The annotations to generate the table row from.
 * @param level The level to generate the table row for.
 */
function getRowsByLevel(annotations: Annotation[], level: string): string {
  const problems = annotations.reduce(
    (map: Map<string, number>, e) =>
      map.set(
        e.title ?? UNKNOWN_RULE_ID,
        map.get(e.title ?? UNKNOWN_RULE_ID) !== undefined
          ? map.get(e.title ?? UNKNOWN_RULE_ID)! + 1
          : 1
      ),
    new Map()
  )
  return Array.from(problems.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([title, count]) => `| \`${title}\` | ${level} | ${count} |`)
    .join('\n')
}

/**
 * Generates action summary string of annotations.
 * @param toolName The name of the tool to generate the summary from.
 * @param annotations The annotations to generate the summary from.
 * @param coverageInfo The coverage is a Markdown text to generate the summary from.
 * @param packages The number of dependencies in the analyzed project.
 * @param licensesInfo The licenses a Markdown text to generate the summary from.
 * @param reportUrl The URL to the Qodana report.
 * @param prMode Whether the analysis was run in the pull request mode.
 */
export function getSummary(
  toolName: string,
  annotations: Annotation[],
  coverageInfo: string,
  packages: number,
  licensesInfo: string,
  reportUrl: string,
  prMode: boolean
): string {
  const contactBlock = wrapToToggleBlock('Contact Qodana team', SUMMARY_MISC)
  let licensesBlock = ''
  if (licensesInfo !== '') {
    licensesBlock = wrapToToggleBlock(
      `Detected ${packages} ${getDepencencyPlural(packages)}`,
      licensesInfo
    )
  }
  let prModeBlock = ''
  if (prMode) {
    prModeBlock = SUMMARY_PR_MODE
  }
  if (reportUrl !== '') {
    const firstToolName = toolName.split(' ')[0]
    toolName = toolName.replace(
      firstToolName,
      `[${firstToolName}](${reportUrl})`
    )
  }
  if (annotations.length === 0) {
    return [
      `# ${toolName}`,
      '',
      '**It seems all right 👌**',
      '',
      'No new problems were found according to the checks applied',
      coverageInfo,
      prModeBlock,
      getViewReportText(reportUrl),
      licensesBlock,
      contactBlock
    ].join('\n')
  }

  return [
    `# ${toolName}`,
    '',
    `**${annotations.length} ${getProblemPlural(
      annotations.length
    )}** were found`,
    '',
    SUMMARY_TABLE_HEADER,
    SUMMARY_TABLE_SEP,
    [
      getRowsByLevel(
        annotations.filter(a => a.annotation_level === ANNOTATION_FAILURE),
        '🔴 Failure'
      ),
      getRowsByLevel(
        annotations.filter(a => a.annotation_level === ANNOTATION_WARNING),
        '🔶 Warning'
      ),
      getRowsByLevel(
        annotations.filter(a => a.annotation_level === ANNOTATION_NOTICE),
        '◽️ Notice'
      )
    ]
      .filter(e => e !== '')
      .join('\n'),
    '',
    coverageInfo,
    prModeBlock,
    getViewReportText(reportUrl),
    licensesBlock,
    contactBlock
  ].join('\n')
}

/**
 * Generates a plural form of the word "problem" depending on the given count.
 * @param count A number representing the count of problems
 * @returns A formatted string with the correct plural form of "problem"
 */
export function getProblemPlural(count: number): string {
  return `new problem${count !== 1 ? 's' : ''}`
}

/**
 * Generates a plural form of the word "dependency" depending on the given count.
 * @param count A number representing the count of dependencies
 * @returns A formatted string with the correct plural form of "dependency"
 */
export function getDepencencyPlural(count: number): string {
  return `dependenc${count !== 1 ? 'ies' : 'y'}`
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
