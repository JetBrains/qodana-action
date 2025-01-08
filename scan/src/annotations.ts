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
import {AnnotationProperties} from '@actions/core'
import * as fs from 'fs'
import type {Log, Result, Tool} from 'sarif'
import {getWorkflowRunUrl, publishGitHubCheck} from './utils'
import {getProblemPlural} from './output'

function getQodanaHelpString(): string {
  return `This result was published with [Qodana GitHub Action](${getWorkflowRunUrl()})`
}
export const ANNOTATION_FAILURE = 'failure'
export const ANNOTATION_WARNING = 'warning'
export const ANNOTATION_NOTICE = 'notice'
const FAILURE_STATUS = 'failure'
const NEUTRAL_STATUS = 'neutral'
const SUCCESS_STATUS = 'success'
const MAX_ANNOTATIONS = 50

export type Conclusion =
  | typeof FAILURE_STATUS
  | typeof SUCCESS_STATUS
  | typeof NEUTRAL_STATUS
  | 'cancelled'
  | 'skipped'
  | 'timed_out'
  | 'action_required'
  | 'stale'
  | undefined

/**
 * Publish SARIF to GitHub Checks.
 * @param name The name of the Check.
 * @param problems The output to publish.
 * @param failedByThreshold flag if the Qodana failThreshold was reached.
 * @param execute whether to execute the promise or not.
 */
export async function publishAnnotations(
  name: string,
  problems: Output,
  failedByThreshold: boolean,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    if (problems.annotations.length >= MAX_ANNOTATIONS) {
      for (let i = 0; i < problems.annotations.length; i += MAX_ANNOTATIONS) {
        await publishGitHubCheck(failedByThreshold, name, {
          title: problems.title,
          text: getQodanaHelpString(),
          summary: problems.summary,
          annotations: problems.annotations.slice(i, i + MAX_ANNOTATIONS)
        })
      }
    } else {
      await publishGitHubCheck(failedByThreshold, name, problems)
    }
  } catch (error) {
    core.info(`Not able to publish annotations with Checks API – ${
      (error as Error).message
    }, 
    using limited (10 problems per level) output instead. Check job permissions (checks: write, pull-requests: write needed)`)
    for (const p of problems.annotations) {
      const properties = toAnnotationProperties(p)
      switch (p.annotation_level) {
        case ANNOTATION_FAILURE:
          core.error(p.message, properties)
          break
        case ANNOTATION_WARNING:
          core.warning(p.message, properties)
          break
        default:
          core.notice(p.message, properties)
      }
    }
  }
}

export interface Output {
  title: string
  summary: string
  text: string
  annotations: Annotation[]
}

export interface Rule {
  shortDescription: string
  fullDescription: string
}

export interface Annotation {
  title: string | undefined
  path: string
  start_line: number
  end_line: number
  annotation_level: 'failure' | 'warning' | 'notice'
  message: string
  start_column: number | undefined
  end_column: number | undefined
}

/**
 * Converts a SARIF result to a GitHub Check Annotation.
 * @param result The SARIF log to convert.
 * @param rules The map of SARIF rule IDs to their descriptions.
 * @param projectDir The path to the project.
 * @returns GitHub Check annotations are created for each result.
 */
function parseResult(
  result: Result,
  rules: Map<string, Rule>,
  projectDir: string
): Annotation | null {
  if (
    !result.locations ||
    result.locations.length === 0 ||
    !result.locations[0].physicalLocation
  ) {
    return null
  }
  const location = result.locations[0].physicalLocation
  const region = location.region
  const pathPrefix =
    projectDir === '' || projectDir.endsWith('/')
      ? projectDir
      : `${projectDir}/`
  return {
    message: result.message.markdown ?? result.message.text!,
    title: rules.get(result.ruleId!)?.shortDescription,
    path: pathPrefix + location.artifactLocation!.uri!,
    start_line: region?.startLine || 0,
    end_line: region?.endLine || region?.startLine || 1,
    start_column:
      region?.startLine === region?.endColumn ? region?.startColumn : undefined,
    end_column:
      region?.startLine === region?.endColumn ? region?.endColumn : undefined,
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
  tool.driver.rules?.forEach(rule => {
    rules.set(rule.id, {
      shortDescription: rule.shortDescription!.text,
      fullDescription:
        rule.fullDescription!.markdown || rule.fullDescription!.text
    })
  })

  tool?.extensions?.forEach(ext => {
    ext?.rules?.forEach(rule => {
      rules.set(rule.id, {
        shortDescription: rule.shortDescription!.text,
        fullDescription:
          rule.fullDescription!.markdown || rule.fullDescription!.text
      })
    })
  })
  return rules
}

/**
 * Converts a SARIF from the given path to a GitHub Check Output.
 * @param path The SARIF path to convert.
 * @param projectDir The path to the project.
 * @returns GitHub Check Outputs with annotations are created for each result.
 */
export function parseSarif(path: string, projectDir: string): Output {
  const sarif: Log = JSON.parse(
    fs.readFileSync(path, {encoding: 'utf8'})
  ) as Log
  const run = sarif.runs[0]
  const rules = parseRules(run.tool)
  let title = 'No new problems found by '
  let annotations: Annotation[] = []
  if (run.results?.length) {
    title = `${run.results.length} ${getProblemPlural(
      run.results.length
    )} found by `
    annotations = run.results
      .filter(result => result.baselineState !== 'unchanged')
      .map(result => parseResult(result, rules, projectDir))
      .filter((a): a is Annotation => a !== null && a !== undefined)
  }
  const name = run.tool.driver.fullName || 'Qodana'
  title += name
  return {
    title,
    text: getQodanaHelpString(),
    summary: title,
    annotations
  }
}

/**
 * Get a conclusion for the given set of annotations
 * @param annotations GitHub Check annotations.
 * @param failedByThreshold flag if the Qodana failThreshold was reached.
 * @returns The conclusion to use for the GitHub Check.
 */
export function getGitHubCheckConclusion(
  annotations: Annotation[],
  failedByThreshold: boolean
): Conclusion {
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
 * Converts Annotation to AnnotationProperties for core GitHub actions API.
 * @param a Annotation to convert.
 */
export function toAnnotationProperties(a: Annotation): AnnotationProperties {
  return {
    title: a.title,
    file: a.path,
    startLine: a.start_line || 0,
    endLine: a.end_line || 1,
    startColumn: a.start_column,
    endColumn: a.end_column
  }
}
