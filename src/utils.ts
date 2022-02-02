import * as artifact from '@actions/artifact'
import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import path from 'path'

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on('uncaughtException', e => core.warning(e.message))

export const QODANA_CHECK_NAME = 'Qodana'
export const QODANA_SARIF_NAME = 'qodana.sarif.json'
export const QODANA_HELP_STRING = `
  📓 Find out how to view [the whole Qodana report](https://www.jetbrains.com/help/qodana/html-report.html).
  📭 Contact us at [qodana-support@jetbrains.com](mailto:qodana-support@jetbrains.com)
  👀 Or via our issue tracker: https://jb.gg/qodana-issue
  🔥 Or share your feedback: https://jb.gg/qodana-discussions
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

export const NOT_SUPPORTED_LINTER = 'linter is not supported by the action!'
export const UNOFFICIAL_LINTER_MESSAGE = `You are using an unofficial Qodana Docker image. 
      This CI pipeline could be not working as expected!`
const QODANA_SUCCESS_EXIT_CODE = 0
const QODANA_FAILTHRESHOLD_EXIT_CODE = 255
export const OFFICIAL_DOCKER_PREFIX = 'jetbrains/'
export const NOT_SUPPORTED_IMAGES = [
  'jetbrains/qodana-clone-finder',
  'jetbrains/qodana-license-audit'
]

/**
 * Uploads the cache to GitHub Actions cache from the given path.
 * @param cacheDir The path to upload the cache from.
 * @param additionalCacheHash Addition to the generated cache hash
 * @param execute whether to execute promise or not.
 */
export async function uploadCaches(
  cacheDir: string,
  additionalCacheHash: string,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    if (isGhes()) {
      core.warning(
        'Cache is not supported on GHES. See https://github.com/actions/cache/issues/505 for more details'
      )
      return
    }
    const primaryKey = `qodana-${process.env['GITHUB_REF']}-${additionalCacheHash}`
    try {
      await cache.saveCache([cacheDir], primaryKey)
      core.info(`Cache saved with key ${primaryKey}`)
    } catch (error) {
      core.warning(
        `Failed to save cache with key ${primaryKey} – ${
          (error as Error).message
        }`
      )
    }
  } catch (error) {
    core.warning(`Failed to upload caches – ${(error as Error).message}`)
  }
}

/**
 * Restores the cache from GitHub Actions cache to the given path.
 * @param cacheDir The path to restore the cache to.
 * @param additionalCacheHash Addition to the generated cache hash.
 * @param execute whether to execute promise or not.
 */
export async function restoreCaches(
  cacheDir: string,
  additionalCacheHash: string,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    if (isGhes()) {
      core.warning(
        'Cache is not supported on GHES. See https://github.com/actions/cache/issues/505 for more details'
      )
      return
    }
    const primaryKey = `qodana-${process.env['GITHUB_REF']}-${additionalCacheHash}`
    const restoreKeys = [`qodana-${process.env['GITHUB_REF']}-`, `qodana-`]
    try {
      const cacheKey = await cache.restoreCache(
        [cacheDir],
        primaryKey,
        restoreKeys
      )
      if (!cacheKey) {
        core.info(
          `Cache not found for input keys: ${[primaryKey, ...restoreKeys].join(
            ', '
          )}`
        )
        return
      }
      core.info(`Cache restored from key: ${cacheKey}`)
    } catch (error) {
      core.warning(
        `Failed to restore cache with key ${primaryKey} – ${
          (error as Error).message
        }`
      )
    }
  } catch (error) {
    core.warning(`Failed to download caches – ${(error as Error).message}`)
  }
}

/**
 * Uploads the Qodana report files from temp directory to GitHub job artifact.
 * @param resultsDir The path to upload report from.
 * @param artifactName Artifact upload name.
 * @param execute whether to execute promise or not.
 */
export async function uploadReport(
  resultsDir: string,
  artifactName: string,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    core.info('Uploading report...')
    const globber = await glob.create(`${resultsDir}/*`)
    const files = await globber.glob()
    await artifact
      .create()
      .uploadArtifact(artifactName, files, path.dirname(resultsDir), {
        continueOnError: true
      })
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
 * Check if Qodana Docker image execution is failed by a threshold set.
 * The codes are documented here: https://www.jetbrains.com/help/qodana/qodana-sarif-output.html#Invocations
 * @param exitCode
 */
export function isFailedByThreshold(exitCode: number): boolean {
  return exitCode === QODANA_FAILTHRESHOLD_EXIT_CODE
}

/**
 * Check if the action is run on GHE.
 */
export function isGhes(): boolean {
  const ghUrl = new URL(
    process.env['GITHUB_SERVER_URL'] || 'https://github.com'
  )
  return ghUrl.hostname.toUpperCase() !== 'GITHUB.COM'
}
