import * as artifact from '@actions/artifact'
import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as glob from '@actions/glob'

export const QODANA_HELP_STRING = `
  📓 Find out how to view [the whole Qodana report](https://www.jetbrains.com/help/qodana/html-report.html).
  📭 Contact us at [qodana-support@jetbrains.com](mailto:qodana-support@jetbrains.com)
  👀 Or via our issue tracker: https://jb.gg/qodana-issue
  🔥 Or share your feedback in our Slack: https://jb.gg/qodana-slack!
`
export const FAILURE_STATUS = 'failure'
export const NEUTRAL_STATUS = 'neutral'
export const SUCCESS_STATUS = 'success'
export const ANNOTATION_FAILURE = 'failure'
export const ANNOTATION_WARNING = 'warning'
export const ANNOTATION_NOTICE = 'notice'
export const MAX_ANNOTATIONS = 50

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
        `${process.env['RUNNER_OS']}-qodana-${process.env['GITHUB_REF']}`,
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
      `${process.env['RUNNER_OS']}-qodana-${process.env['GITHUB_REF']}`
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
}
