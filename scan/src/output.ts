/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as core from '@actions/core'
import * as fs from 'fs'
import * as github from '@actions/github'
import {GetResponseDataTypeFromEndpointMethod} from '@octokit/types'
import {
  QODANA_LICENSES_JSON,
  QODANA_LICENSES_MD,
  QODANA_REPORT_URL_NAME,
  QODANA_SARIF_NAME,
  VERSION
} from '../../common/qodana'
import {getInputs, getProblemPlural, isPRMode} from './utils'
import {
  Annotation,
  ANNOTATION_FAILURE,
  ANNOTATION_NOTICE,
  ANNOTATION_WARNING,
  parseSarif,
  publishAnnotations
} from './annotations'

const QODANA_CHECK_NAME = 'Qodana'
const UNKNOWN_RULE_ID = 'Unknown'
const SUMMARY_TABLE_HEADER = '| Name | Severity | Problems |'
const SUMMARY_TABLE_SEP = '| --- | --- | --- |'
const SUMMARY_MISC = `Contact us at [qodana-support@jetbrains.com](mailto:qodana-support@jetbrains.com)
  - Or via our issue tracker: https://jb.gg/qodana-issue
  - Or share your feedback: https://jb.gg/qodana-discussions`
const VIEW_REPORT_OPTIONS = `To be able to view the detailed Qodana report, you can either:
  1. Register at [Qodana Cloud](https://qodana.cloud/) and [configure the action](https://github.com/jetbrains/qodana-action#qodana-cloud)
  2. Use [GitHub Code Scanning with Qodana](https://github.com/jetbrains/qodana-action#github-code-scanning)
  3. Host [Qodana report at GitHub Pages](https://github.com/JetBrains/qodana-action/blob/3a8e25f5caad8d8b01c1435f1ef7b19fe8b039a0/README.md#github-pages)
  4. Inspect and use \`qodana.sarif.json\` (see [the Qodana SARIF format](https://www.jetbrains.com/help/qodana/qodana-sarif-output.html#Report+structure) for details)
`
const SUMMARY_PR_MODE = `💡 Qodana analysis was run in the pull request mode: only the changed files were checked`

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
          ? map.get(e.title)!! + 1
          : 1
      ),
    new Map()
  )
  return Array.from(problems.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([title, count]) => `| ${title} | ${level} | ${count} |`)
    .join('\n')
}

/**
 * Generates action summary string of annotations.
 * @param annotations The annotations to generate the summary from.
 * @param licensesInfo The licenses a Markdown text to generate the summary from.
 * @param reportUrl The URL to the Qodana report.
 */
function getSummary(
  annotations: Annotation[],
  licensesInfo: string,
  reportUrl: string
): string {
  const contactBlock = wrapToToggleBlock('Contact Qodana team', SUMMARY_MISC)
  let licensesBlock = ''
  if (licensesInfo !== '') {
    licensesBlock = wrapToToggleBlock('Dependencies licenses', licensesInfo)
  }
  let prModeBlock = ''
  if (isPRMode()) {
    prModeBlock = SUMMARY_PR_MODE
  }
  if (annotations.length === 0) {
    return [
      `# ${QODANA_CHECK_NAME}`,
      '',
      '**It seems all right 👌**',
      '',
      'No new problems found according to the checks applied',
      prModeBlock,
      getViewReportText(reportUrl),
      licensesBlock,
      contactBlock
    ].join('\n')
  }

  return [
    `# ${QODANA_CHECK_NAME}`,
    '',
    `**${annotations.length} ${getProblemPlural(annotations.length)}** found`,
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
    prModeBlock,
    getViewReportText(reportUrl),
    licensesBlock,
    contactBlock
  ].join('\n')
}

/**
 * Publish SARIF to GitHub Checks.
 * @param failedByThreshold flag if the Qodana failThreshold was reached.
 * @param resultsDir The path to the results.
 * @param postComment whether to post a PR comment or not.
 * @param execute whether to execute the promise or not.
 * @param useAnnotations whether to publish annotations or not.
 */
export async function publishOutput(
  failedByThreshold: boolean,
  resultsDir: string,
  useAnnotations: boolean,
  postComment: boolean,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    const problems = parseSarif(`${resultsDir}/${QODANA_SARIF_NAME}`)
    let reportUrl = ''
    const reportUrlFile = `${resultsDir}/${QODANA_REPORT_URL_NAME}`
    if (fs.existsSync(reportUrlFile)) {
      reportUrl = fs.readFileSync(`${resultsDir}/${QODANA_REPORT_URL_NAME}`, {
        encoding: 'utf8'
      })
    }

    let licensesInfo = ''
    const licensesJson = `${resultsDir}/projectStructure/${QODANA_LICENSES_JSON}`
    if (fs.existsSync(licensesJson)) {
      const licenses = JSON.parse(
        fs.readFileSync(licensesJson, {encoding: 'utf8'})
      )
      if (licenses.length > 0) {
        licensesInfo = fs.readFileSync(
          `${resultsDir}/projectStructure/${QODANA_LICENSES_MD}`,
          {encoding: 'utf8'}
        )
      }
    }
    const annotations: Annotation[] = problems.annotations ?? []
    const toolName = problems.title.split('found by ')[1] ?? QODANA_CHECK_NAME
    problems.summary = getSummary(annotations, licensesInfo, reportUrl)

    await Promise.all([
      postResultsToPRComments(problems.summary, postComment),
      core.summary.addRaw(problems.summary).write(),
      publishAnnotations(
        toolName,
        problems,
        failedByThreshold,
        getInputs().githubToken,
        useAnnotations
      )
    ])
  } catch (error) {
    core.warning(
      `Qodana has problems with publishing results to GitHub – ${
        (error as Error).message
      }`
    )
  }
}

/**
 * Post a new comment to the pull request.
 * @param content The comment to post.
 * @param postComment Whether to post a comment or not.
 */
async function postResultsToPRComments(
  content: string,
  postComment: boolean
): Promise<void> {
  const context = github.context
  const pr = context.payload.pull_request ?? ''
  if (!postComment || !pr) {
    return
  }
  const issue_number = pr?.number ?? 0
  if (issue_number === 0) {
    core.warning(
      'Could not find pull request to post comment to in the current context'
    )
    return
  }

  const client = github.getOctokit(getInputs().githubToken)

  const comment_tag_pattern = `<!-- JetBrains/qodana-action@v${VERSION} -->`
  const body = comment_tag_pattern
    ? `${content}\n${comment_tag_pattern}`
    : content

  type ListCommentsResponseDataType = GetResponseDataTypeFromEndpointMethod<
    typeof client.rest.issues.listComments
  >
  let comment: ListCommentsResponseDataType[0] | undefined

  for await (const {data: comments} of client.paginate.iterator(
    client.rest.issues.listComments,
    {
      ...context.repo,
      issue_number
    }
  )) {
    comment = comments.find(c => c?.body?.includes(comment_tag_pattern))
    if (comment) break
  }

  if (comment) {
    await client.rest.issues.updateComment({
      ...context.repo,
      comment_id: comment.id,
      body
    })
  } else {
    await client.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body
    })
  }
}
