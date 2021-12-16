import * as artifact from '@actions/artifact'
import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import {Inputs} from './context'

export const QODANA_CHECK_NAME = 'Qodana'
export const QODANA_HELP_STRING = `
  📓 Find out how to view [the whole Qodana report](https://www.jetbrains.com/help/qodana/html-report.html).
  📭 Contact us at [qodana-support@jetbrains.com](mailto:qodana-support@jetbrains.com)
  👀 Or via our issue tracker: https://jb.gg/qodana-issue
  🔥 Or share your feedback in our Slack: https://jb.gg/qodana-slack
`
export const FAIL_THRESHOLD_OUTPUT =
  'The number of problems exceeds the failThreshold'
export const FAILURE_STATUS = 'failure'
export const NEUTRAL_STATUS = 'neutral'
export const SUCCESS_STATUS = 'success'
export const ANNOTATION_FAILURE = 'failure'
export const ANNOTATION_WARNING = 'warning'
export const ANNOTATION_NOTICE = 'notice'
export const MAX_ANNOTATIONS = 50

const NOT_SUPPORTED_LINTER = 'linter is not supported by the action!'
const UNOFFICIAL_LINTER_MESSAGE = `You are using an unofficial Qodana Docker image. 
      This CI pipeline could be not working as expected!`
const QODANA_SUCCESS_EXIT_CODE = 0
const QODANA_FAILTHRESHOLD_EXIT_CODE = 255
const OFFICIAL_DOCKER_PREFIX = 'jetbrains/'
const NOT_SUPPORTED_IMAGES = [
  'jetbrains/qodana-clone-finder',
  'jetbrains/qodana-license-audit'
]

/**
 * Validates the given inputs.
 * @param inputs action inputs.
 * @return action inputs.
 */
export function validateContext(inputs: Inputs): Inputs {
  if (NOT_SUPPORTED_IMAGES.includes(inputs.linter)) {
    throw Error(`${inputs.linter} ${NOT_SUPPORTED_LINTER}`)
  }

  if (!inputs.linter.startsWith(OFFICIAL_DOCKER_PREFIX)) {
    core.warning(UNOFFICIAL_LINTER_MESSAGE)
  }
  return inputs
}

/**
 * Restores the cache from GitHub Actions cache to the given path.
 * @param path The path to restore the cache to.
 */
export async function restoreCaches(path: string): Promise<void> {
  try {
    await cache.restoreCache(
      [path],
      `${process.env['RUNNER_OS']}-qodana-${process.env['GITHUB_REF']}`,
      [
        `${process.env['RUNNER_OS']}-qodana-${process.env['GITHUB_REF']}-`,
        `${process.env['RUNNER_OS']}-qodana-`
      ]
    )
  } catch (error) {
    core.warning(`Failed to download caches – ${(error as Error).message}`)
  }
}

/**
 * Uploads the cache to GitHub Actions cache from the given path.
 * @param path The path to upload the cache from.
 */
export async function uploadCaches(path: string): Promise<void> {
  try {
    await cache.saveCache(
      [path],
      `${process.env['RUNNER_OS']}-qodana-${process.env['GITHUB_REF']}-${process.env['GITHUB_SHA']}`
    )
  } catch (error) {
    core.warning(`Failed to upload caches – ${(error as Error).message}`)
  }
}

/**
 * Uploads the Qodana report files from temp directory to GitHub job artifact.
 * @param path The path to upload report from (should be somewhere in tmp).
 */
export async function uploadReport(path: string): Promise<void> {
  try {
    const globber = await glob.create(`${path}/*`)
    const files = await globber.glob()
    await artifact
      .create()
      .uploadArtifact(
        'Qodana report',
        files,
        `${process.env['RUNNER_TEMP']}/qodana/`,
        {
          continueOnError: true
        }
      )
  } catch (error) {
    core.warning(`Failed to upload report – ${(error as Error).message}`)
  }
}

/**
 * Check if Qodana Docker image execution is successful.
 * The codes are documented here: https://www.jetbrains.com/help/qodana/qodana-sarif-output.html#Invocations
 * @param exitCode
 */
export function isExecutionSuccessful(exitCode: number): boolean {
  return exitCode === QODANA_SUCCESS_EXIT_CODE || isFailedByThreshold(exitCode)
}

/**
 * Check if Qodana Docker image execution is failed by threshold set.
 * The codes are documented here: https://www.jetbrains.com/help/qodana/qodana-sarif-output.html#Invocations
 * @param exitCode
 */
export function isFailedByThreshold(exitCode: number): boolean {
  return exitCode === QODANA_FAILTHRESHOLD_EXIT_CODE
}
