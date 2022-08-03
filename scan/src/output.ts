/* eslint-disable @typescript-eslint/no-non-null-assertion,github/array-foreach */
import * as core from '@actions/core'
import * as fs from 'fs'
import type {Log, Result, Tool} from 'sarif'
import {AnnotationProperties} from '@actions/core'

const QODANA_CHECK_NAME = 'Qodana'
const UNKNOWN_RULE_ID = 'Unknown'
const ANNOTATION_FAILURE = 'failure'
const ANNOTATION_WARNING = 'warning'
const ANNOTATION_NOTICE = 'notice'
const SUMMARY_TABLE_HEADER = '| Name | Severity | Problems |'
const SUMMARY_TABLE_SEP = '| --- | --- | --- |'
const SUMMARY_MISC = `### Contact us

  Contact us at [qodana-support@jetbrains.com](mailto:qodana-support@jetbrains.com)
  - Or via our issue tracker: https://jb.gg/qodana-issue
  - Or share your feedback: https://jb.gg/qodana-discussions`

export interface Rule {
  shortDescription: string
  fullDescription: string
}

export interface Annotation {
  message: string
  level: string
  properties: AnnotationProperties
}

function getViewReportText(sarifPath: string): string {
  const sarif: Log = JSON.parse(fs.readFileSync(sarifPath, {encoding: 'utf8'}))
  const link = sarif.runs?.[0]?.properties?.['reportUrl']
  if (link) {
    return `☁️ [View the Qodana report](${link})`
  }
  return 'Find out how to view [the Qodana report](https://www.jetbrains.com/help/qodana/html-report.html)'
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
        e.properties.title ?? UNKNOWN_RULE_ID,
        map.get(e.properties.title ?? UNKNOWN_RULE_ID) !== undefined
          ? map.get(e.properties.title!!)!! + 1
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
 * @param shortSarifPath The path to the SARIF file.
 */
function getSummary(annotations: Annotation[], shortSarifPath: string): string {
  if (annotations.length === 0) {
    return [
      `# ${QODANA_CHECK_NAME}`,
      '',
      '**It seems all right 👌**',
      '',
      'No problems found according to the checks applied',
      SUMMARY_MISC
    ].join('\n')
  }

  return [
    `# ${QODANA_CHECK_NAME}`,
    '',
    `**${annotations.length} problem${
      annotations.length !== 1 ? 's' : ''
    }** found`,
    '',
    SUMMARY_TABLE_HEADER,
    SUMMARY_TABLE_SEP,
    [
      getRowsByLevel(
        annotations.filter(a => a.level === ANNOTATION_FAILURE),
        '🔴 Failure'
      ),
      getRowsByLevel(
        annotations.filter(a => a.level === ANNOTATION_WARNING),
        '🔶 Warning'
      ),
      getRowsByLevel(
        annotations.filter(a => a.level === ANNOTATION_NOTICE),
        '◽️ Notice'
      )
    ]
      .filter(e => e !== '')
      .join('\n'),
    '',
    getViewReportText(shortSarifPath),
    SUMMARY_MISC
  ].join('\n')
}

/**
 * Converts a SARIF result to a GitHub Check Annotation.
 * @param result The SARIF log to convert.
 * @param rules The map of SARIF rule IDs to their descriptions.
 * @returns GitHub Check annotations are created for each result.
 */
function resultToAnnotation(
  result: Result,
  rules: Map<string, Rule>
): Annotation | null {
  const location = result.locations!![0].physicalLocation!!
  const region = location.region!!
  return {
    message: result.message.markdown!!,
    level: (() => {
      switch (result.level) {
        case 'error':
          return ANNOTATION_FAILURE
        case 'warning':
          return ANNOTATION_WARNING
        default:
          return ANNOTATION_NOTICE
      }
    })(),
    properties: {
      title: rules.get(result.ruleId!!)?.shortDescription!!,
      file: location.artifactLocation!!.uri!!,
      startLine: region.startLine!!,
      endLine: region.endLine || region.startLine!!,
      startColumn:
        region.startLine === region.endColumn ? region.startColumn : undefined,
      endColumn:
        region.startLine === region.endColumn ? region.endColumn : undefined
    }
  }
}

/**
 * Extracts the rules descriptions from SARIF tool field.
 * @param tool the SARIF tool field.
 * @returns The map of SARIF rule IDs to their descriptions.
 */
function parseRules(tool: Tool): Map<string, Rule> {
  const rules = new Map<string, Rule>()
  tool?.extensions?.forEach(ext => {
    ext?.rules?.forEach(rule => {
      rules.set(rule.id, {
        shortDescription: rule.shortDescription!!.text,
        fullDescription: rule.fullDescription!!.markdown!!
      })
    })
  })
  return rules
}

/**
 * Converts a SARIF from the given path to a GitHub Check Output.
 * @param path The SARIF path to convert.
 * @returns GitHub Check Outputs with annotations are created for each result.
 */
export function parseSarif(path: string): Annotation[] {
  const sarif: Log = JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}))
  const run = sarif.runs[0]
  const rules = parseRules(run.tool)
  let annotations: Annotation[] = []
  if (run.results?.length) {
    annotations = run.results
      .filter(result => result.baselineState !== 'unchanged')
      .map(result => resultToAnnotation(result, rules))
      .filter((a): a is Annotation => a !== null)
  }
  return annotations
}

/**
 * Publish SARIF to GitHub Checks.
 * @param failedByThreshold flag if the Qodana failThreshold was reached.
 * @param sarifPath The path to the SARIF file to publish.
 * @param shortSarifPath The path to the short SARIF file to publish.
 * @param execute whether to execute the promise or not.
 * @param useAnnotations whether to publish annotations or not.
 */
export async function publishOutput(
  failedByThreshold: boolean,
  sarifPath: string,
  shortSarifPath: string,
  execute: boolean,
  useAnnotations: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    const problems = parseSarif(sarifPath)
    if (useAnnotations) {
      for (const p of problems) {
        switch (p.level) {
          case ANNOTATION_FAILURE:
            core.error(p.message, p.properties)
            break
          case ANNOTATION_WARNING:
            core.warning(p.message, p.properties)
            break
          default:
            core.notice(p.message, p.properties)
        }
      }
    }
    await core.summary.addRaw(getSummary(problems, shortSarifPath)).write()
  } catch (error) {
    core.warning(`Failed to publish annotations – ${(error as Error).message}`)
  }
}
