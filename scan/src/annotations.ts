/* eslint-disable @typescript-eslint/no-non-null-assertion,github/array-foreach */
import * as core from '@actions/core'
import * as fs from 'fs'
import type {Log, Result, Tool} from 'sarif'
import {context, getOctokit} from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'

export const QODANA_HELP_STRING = `
  📓 Find out how to view [the whole Qodana report](https://www.jetbrains.com/help/qodana/html-report.html).
  📭 Contact us at [qodana-support@jetbrains.com](mailto:qodana-support@jetbrains.com)
  👀 Or via our issue tracker: https://jb.gg/qodana-issue
  🔥 Or share your feedback: https://jb.gg/qodana-discussions
`
export const QODANA_CHECK_NAME = 'Qodana'
const FAILURE_STATUS = 'failure'
const NEUTRAL_STATUS = 'neutral'
const SUCCESS_STATUS = 'success'
const ANNOTATION_FAILURE = 'failure'
const ANNOTATION_WARNING = 'warning'
const ANNOTATION_NOTICE = 'notice'
const MAX_ANNOTATIONS = 50

export interface Rule {
  shortDescription: string
  fullDescription: string
}

export interface Output {
  title: string
  summary: string
  text: string
  annotations: Annotation[]
}

export interface Annotation {
  title: string
  path: string
  start_line: number
  end_line: number
  annotation_level: string
  message: string
  start_column: number | undefined
  end_column: number | undefined
}

/**
 * Converts a SARIF result to a GitHub Check Annotation.
 * @param result The SARIF log to convert.
 * @param rules The map of SARIF rule IDs to their descriptions.
 * @returns GitHub Check annotations are created for each result.
 */
function parseResult(
  result: Result,
  rules: Map<string, Rule>
): Annotation | null {
  const location = result.locations!![0].physicalLocation!!
  const region = location.region!!
  return {
    message: result.message.markdown!!,
    title: rules.get(result.ruleId!!)?.shortDescription!!,
    path: location.artifactLocation!!.uri!!,
    start_line: region.startLine!!,
    end_line: region.endLine || region.startLine!!,
    start_column:
      region.startLine === region.endColumn ? region.startColumn : undefined,
    end_column:
      region.startLine === region.endColumn ? region.endColumn : undefined,
    annotation_level: (() => {
      switch (result.level) {
        case 'error':
          return ANNOTATION_FAILURE
        case 'warning':
          return ANNOTATION_WARNING
        default:
          return ANNOTATION_NOTICE
      }
    })()
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
export function parseSarif(path: string): Output {
  const sarif: Log = JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}))
  const run = sarif.runs[0]
  const rules = parseRules(run.tool)
  let summary = 'No problems found.'
  let annotations: Annotation[] = []
  if (run.results?.length) {
    summary = `${run.results.length} problems were detected.`
    annotations = run.results
      .filter(result => result.baselineState !== 'unchanged')
      .map(result => parseResult(result, rules))
      .filter((a): a is Annotation => a !== null && a !== undefined)
  }
  return {
    title: QODANA_CHECK_NAME,
    text: QODANA_HELP_STRING,
    summary,
    annotations
  }
}

/**
 * Creates a GitHub Check.
 * @param octokit The GitHub API client.
 * @param conclusion The conclusion to use for the GitHub Check.
 * @param head_sha The SHA of the head commit.
 * @param name The name of the Check.
 * @param output The Check Output to use.
 */
async function createCheck(
  octokit: InstanceType<typeof GitHub>,
  conclusion: string,
  head_sha: string,
  name: string,
  output: Output
): Promise<void> {
  await octokit.rest.checks.create({
    ...context.repo,
    accept: 'application/vnd.github.v3+json',
    status: 'completed',
    head_sha,
    conclusion,
    name,
    output
  })
}

/**
 * Updates a GitHub Check.
 * @param octokit The GitHub API client.
 * @param conclusion The conclusion to use for the GitHub Check.
 * @param check_run_id The ID of the GitHub Check to use for the update.
 * @param output The Check Output to use.
 */
async function updateCheck(
  octokit: InstanceType<typeof GitHub>,
  conclusion: string,
  check_run_id: number,
  output: Output
): Promise<void> {
  await octokit.rest.checks.update({
    ...context.repo,
    accept: 'application/vnd.github.v3+json',
    status: 'completed',
    conclusion,
    check_run_id,
    output
  })
}

/**
 * Get a conclusion for the given set of annotations
 * @param annotations GitHub Check annotations.
 * @param failedByThreshold flag if the Qodana failThreshold was reached.
 * @returns The conclusion to use for the GitHub Check.
 */
function getConclusion(
  annotations: Annotation[],
  failedByThreshold: boolean
): string {
  if (failedByThreshold) {
    return FAILURE_STATUS
  }
  const s = new Set(annotations.map(a => a.annotation_level))
  if (
    s.has(ANNOTATION_FAILURE) ||
    s.has(ANNOTATION_NOTICE) ||
    s.has(ANNOTATION_WARNING)
  ) {
    return NEUTRAL_STATUS
  }
  return SUCCESS_STATUS
}

/**
 * Publish GitHub Checks output to GitHub Checks.
 * @param failedByThreshold flag if the Qodana failThreshold was reached.
 * @param token The GitHub token to use.
 * @param output The output to publish.
 */
async function publishOutput(
  failedByThreshold: boolean,
  token: string,
  output: Output
): Promise<void> {
  const conclusion = getConclusion(output.annotations, failedByThreshold)
  let sha = context.sha
  if (context.payload.pull_request) {
    sha = context.payload.pull_request.head.sha
  }
  const octokit = getOctokit(token)
  const result = await octokit.rest.checks.listForRef({
    ...context.repo,
    ref: sha
  })
  const checkExists = result.data.check_runs.find(
    check => check.name === output.title
  )
  if (checkExists) {
    await updateCheck(octokit, conclusion, checkExists.id, output)
  } else {
    await createCheck(octokit, conclusion, sha, output.title, output)
  }
}

/**
 * Publish SARIF to GitHub Checks.
 * @param failedByThreshold flag if the Qodana failThreshold was reached.
 * @param token The GitHub token to use.
 * @param path The path to the SARIF file to publish.
 * @param execute whether to execute the promise or not.
 */
export async function publishAnnotations(
  failedByThreshold: boolean,
  token: string,
  path: string,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    const output = parseSarif(path)
    if (output.annotations.length >= MAX_ANNOTATIONS) {
      for (let i = 0; i < output.annotations.length; i += MAX_ANNOTATIONS) {
        await publishOutput(failedByThreshold, token, {
          title: output.title,
          text: QODANA_HELP_STRING,
          summary: output.summary,
          annotations: output.annotations.slice(i, i + MAX_ANNOTATIONS)
        })
      }
    } else {
      await publishOutput(failedByThreshold, token, output)
    }
  } catch (error) {
    core.warning(`Failed to publish annotations – ${(error as Error).message}`)
  }
}
