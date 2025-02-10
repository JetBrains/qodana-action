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

import {
  Coverage,
  QODANA_LICENSES_JSON,
  QODANA_LICENSES_MD,
  QODANA_OPEN_IN_IDE_NAME,
  QODANA_REPORT_URL_NAME, VERSION,
} from "./qodana";
import * as fs from "fs";
import type {Log, Result} from 'sarif'
import {parseRules, Rule} from './utils'

export const COMMIT_USER = 'qodana-bot'
export const COMMIT_EMAIL = 'qodana-support@jetbrains.com'
export const QODANA_CHECK_NAME = 'Qodana'
const UNKNOWN_RULE_ID = 'Unknown'
const SUMMARY_TABLE_HEADER = '| Inspection name | Severity | Problems |'
const SUMMARY_TABLE_SEP = '| --- | --- | --- |'
const SUMMARY_MISC = `Contact us at [qodana-support@jetbrains.com](mailto:qodana-support@jetbrains.com)
  - Or via our issue tracker: https://jb.gg/qodana-issue
  - Or share your feedback: https://jb.gg/qodana-discussions`

const SUMMARY_PR_MODE = `💡 Qodana analysis was run in the pull request mode: only the changed files were checked`

export const FAILURE_LEVEL = 'failure'
export const WARNING_LEVEL = 'warning'
export const NOTICE_LEVEL = 'notice'

export interface ProblemDescriptor {
  title: string | undefined
  level: 'failure' | 'warning' | 'notice'
}

interface CloudData {
  url?: string
}

interface OpenInIDEData {
  cloud?: CloudData
}

export interface LicenseEntry {
  name?: string
  version?: string
  license?: string
}

export interface LicenseInfo {
  licenses: string,
  packages: number
}

export interface Output {
  title: string
  summary: string
  text: string
  problemDescriptions: ProblemDescriptor[]
}

export function parseSarif(path: string, text: string): Output {
  const sarif: Log = JSON.parse(
    fs.readFileSync(path, {encoding: 'utf8'})
  ) as Log
  const run = sarif.runs[0]
  const rules = parseRules(run.tool)
  let title = 'No new problems found by '
  let problemDescriptions: ProblemDescriptor[] = []
  if (run.results?.length) {
    title = `${run.results.length} ${getProblemPlural(
      run.results.length
    )} found by `
    problemDescriptions = run.results
      .filter(
        result =>
          result.baselineState !== 'unchanged' &&
          result.baselineState !== 'absent'
      )
      .map(result => parseResult(result, rules))
      .filter((a): a is ProblemDescriptor => a !== null && a !== undefined)
  }
  const name = run.tool.driver.fullName || 'Qodana'
  title += name
  return {
    title,
    text: text,
    summary: title,
    problemDescriptions
  }
}

export function parseResult(
  result: Result,
  rules: Map<string, Rule>
): ProblemDescriptor | null {
  if (
    !result.locations ||
    result.locations.length === 0 ||
    !result.locations[0].physicalLocation
  ) {
    return null
  }
  return {
    title: rules.get(result.ruleId!)?.shortDescription,
    level: (() => {
      switch (result.level) {
        case 'error':
          return FAILURE_LEVEL
        case 'warning':
          return WARNING_LEVEL
        default:
          return NOTICE_LEVEL
      }
    })()
  }
}

function wrapToDiffBlock(message: string): string {
  return `\`\`\`diff
${message}
\`\`\``
}

function makeConclusion(
  conclusion: string,
  failedByThreshold: boolean,
  useDiffBlock: boolean,
): string {
  if (useDiffBlock) {
    return failedByThreshold ? `- ${conclusion}` : `+ ${conclusion}`
  } else {
    return failedByThreshold
      ? `<span style="background-color: #ffe6e6; color: red;">${conclusion}</span>`
      : `<span style="background-color: #e6f4e6; color: green;">${conclusion}</span>`
  }
}

export function getCoverageStats(c: Coverage, useDiffBlock: boolean): string {
  if (c.totalLines === 0 && c.totalCoveredLines === 0) {
    return ''
  }

  let stats = ''
  if (c.totalLines !== 0) {
    const conclusion = `${c.totalCoverage}% total lines covered`
    stats += `${makeConclusion(conclusion, c.totalCoverage < c.totalCoverageThreshold, useDiffBlock)}
${c.totalLines} lines analyzed, ${c.totalCoveredLines} lines covered`
  }

  if (c.freshLines !== 0) {
    const conclusion = `${c.freshCoverage}% fresh lines covered`
    stats += `
${makeConclusion(conclusion, c.freshCoverage < c.freshCoverageThreshold, useDiffBlock)}
${c.freshLines} lines analyzed, ${c.freshCoveredLines} lines covered`
  }

  const coverageBlock =  [
    `@@ Code coverage @@`,
    `${stats}`,
    `# Calculated according to the filters of your coverage tool`
  ].join('\n')
  return useDiffBlock ? wrapToDiffBlock(coverageBlock) : coverageBlock
}

export function getLicenseInfo(
  resultsDir: string,
): LicenseInfo {
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
  return { licenses: licensesInfo, packages: packages }
}

export function getReportURL(resultsDir: string): string {
  let reportUrlFile = `${resultsDir}/${QODANA_OPEN_IN_IDE_NAME}`
  if (fs.existsSync(reportUrlFile)) {
    const rawData = fs.readFileSync(reportUrlFile, {encoding: 'utf8'})
    const data = JSON.parse(rawData) as OpenInIDEData
    if (data?.cloud?.url) {
      return data.cloud.url
    }
  } else {
    reportUrlFile = `${resultsDir}/${QODANA_REPORT_URL_NAME}`
    if (fs.existsSync(reportUrlFile)) {
      return fs.readFileSync(reportUrlFile, {encoding: 'utf8'})
    }
  }
  return ''
}

function wrapToToggleBlock(header: string, body: string): string {
  return `<details>
<summary>${header}</summary>

${body}
</details>`
}

function getViewReportText(reportUrl: string, viewReportOptions: string): string {
  if (reportUrl !== '') {
    return `☁️ [View the detailed Qodana report](${reportUrl})`
  }
  return wrapToToggleBlock(
    'View the detailed Qodana report',
    viewReportOptions
  )
}

/**
 * Generates a table row for a given level.
 * @param annotations The annotations to generate the table row from.
 * @param level The level to generate the table row for.
 */
function getRowsByLevel(annotations: ProblemDescriptor[], level: string): string {
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
 * @param projectDir The path to the project.
 * @param sourceDir The path to analyzed directory inside the project.
 * @param problemsDescriptors The descriptions of problems to generate the summary from.
 * @param coverageInfo The coverage is a Markdown text to generate the summary from.
 * @param packages The number of dependencies in the analyzed project.
 * @param licensesInfo The licenses a Markdown text to generate the summary from.
 * @param reportUrl The URL to the Qodana report.
 * @param prMode Whether the analysis was run in the pull request mode.
 * @param dependencyCharsLimit Limit on how many characters can be included in comment
 * @param reportViewOptionsHelp Instructions of how to configure a report viewing for tool
 */
export function getSummary(
  toolName: string,
  projectDir: string,
  sourceDir: string,
  problemsDescriptors: ProblemDescriptor[],
  coverageInfo: string,
  packages: number,
  licensesInfo: string,
  reportUrl: string,
  prMode: boolean,
  dependencyCharsLimit: number,
  reportViewOptionsHelp: string
): string {
  const contactBlock = wrapToToggleBlock('Contact Qodana team', SUMMARY_MISC)
  let licensesBlock = ''
  if (licensesInfo !== '' && licensesInfo.length < dependencyCharsLimit) {
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
  const analysisScope = (
    projectDir === ''
      ? ''
      : ['Analyzed project: `', projectDir, '/`\n'].join('')
  ).concat(
    sourceDir === ''
      ? ''
      : ['Analyzed directory: `', sourceDir, '/`\n'].join('')
  )
  if (problemsDescriptors.length === 0) {
    return [
      `# ${toolName}`,
      analysisScope,
      '**It seems all right 👌**',
      '',
      'No new problems were found according to the checks applied',
      coverageInfo,
      prModeBlock,
      getViewReportText(reportUrl, reportViewOptionsHelp),
      licensesBlock,
      contactBlock
    ].join('\n')
  }

  return [
    `# ${toolName}`,
    analysisScope,
    `**${problemsDescriptors.length} ${getProblemPlural(
      problemsDescriptors.length
    )}** were found`,
    '',
    SUMMARY_TABLE_HEADER,
    SUMMARY_TABLE_SEP,
    [
      getRowsByLevel(
        problemsDescriptors.filter(a => a.level === FAILURE_LEVEL),
        '🔴 Failure'
      ),
      getRowsByLevel(
        problemsDescriptors.filter(a => a.level === WARNING_LEVEL),
        '🔶 Warning'
      ),
      getRowsByLevel(
        problemsDescriptors.filter(a => a.level === NOTICE_LEVEL),
        '◽️ Notice'
      )
    ]
      .filter(e => e !== '')
      .join('\n'),
    '',
    coverageInfo,
    prModeBlock,
    getViewReportText(reportUrl, reportViewOptionsHelp),
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

export function getCommentTag(toolName: string, sourceDir: string): string {
  // source dir needed in case of monorepo with projects analyzed by the same tool
  return `<!-- JetBrains/qodana-action@v${VERSION} : ${toolName}, ${sourceDir} -->`
}