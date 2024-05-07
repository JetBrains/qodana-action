// noinspection JSUnusedGlobalSymbols
import {checksum, version} from './cli.json'
import {createHash} from 'crypto'
import fs from 'fs'

export const SUPPORTED_PLATFORMS = ['windows', 'linux']
export const SUPPORTED_ARCHS = ['x86_64', 'arm64']
export const FAIL_THRESHOLD_OUTPUT =
  'The number of problems exceeds the failThreshold'
export const QODANA_SARIF_NAME = 'qodana.sarif.json'
export const QODANA_SHORT_SARIF_NAME = 'qodana-short.sarif.json'
export const QODANA_REPORT_URL_NAME = 'qodana.cloud'
export const QODANA_OPEN_IN_IDE_NAME = 'open-in-ide.json'

export const QODANA_LICENSES_MD = 'thirdPartySoftwareList.md'
export const QODANA_LICENSES_JSON = 'third-party-libraries.json'
export const EXECUTABLE = 'qodana'
export const VERSION = version

export const COVERAGE_THRESHOLD = 50

export function getQodanaSha256(arch: string, platform: string): string {
  switch (`${platform}_${arch}`) {
    case 'windows_x86_64':
      return checksum['windows_x86_64']
    case 'windows_arm64':
      return checksum['windows_arm64']
    case 'linux_x86_64':
      return checksum['linux_x86_64']
    case 'linux_arm64':
      return checksum['linux_arm64']
    default:
      throw new Error(`Qodana CLI does not exist for ${platform}_${arch}`)
  }
}

/**
 * Returns the architecture name suitable for the published Qodana CLI archive name.
 */
export function getProcessArchName(): string {
  if (process.platform === 'darwin') {
    return 'all'
  }
  return process.arch === 'x64' ? 'x86_64' : 'arm64'
}

/**
 * Returns the platform name suitable for the published Qodana CLI archive name.
 */
export function getProcessPlatformName(): string {
  // noinspection JSDeprecatedSymbols
  return process.platform === 'win32' ? 'windows' : process.platform
}

/**
 * Gets Qodana CLI download URL from the GitHub Releases API.
 */
export function getQodanaUrl(
  arch: string,
  platform: string,
  nightly = false
): string {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`)
  }
  if (!SUPPORTED_ARCHS.includes(arch)) {
    throw new Error(`Unsupported architecture: ${arch}`)
  }
  const archive = platform === 'windows' ? 'zip' : 'tar.gz'
  const cli_version = nightly ? 'nightly' : `v${version}`
  return `https://github.com/JetBrains/qodana-cli/releases/download/${cli_version}/qodana_${platform}_${arch}.${archive}`
}

// eslint-disable-next-line no-shadow -- shadowing is intentional here (ESLint bug)
export enum QodanaExitCode {
  Success = 0,
  FailThreshold = 255
}

/**
 * Check if Qodana Docker image execution is successful.
 * The codes are documented here: https://www.jetbrains.com/help/qodana/qodana-sarif-output.html#Invocations
 * @param exitCode
 */
export function isExecutionSuccessful(exitCode: number): boolean {
  return Object.values(QodanaExitCode).includes(exitCode)
}

/**
 * Finds the wanted argument value in the given args if there is one.
 * @param argShort the short argument name.
 * @param argLong the long argument name.
 * @param args command arguments.
 * @returns the arg value to use.
 */
export function extractArg(
  argShort: string,
  argLong: string,
  args: string[]
): string {
  let arg = ''
  for (let i = 0; i < args.length; i++) {
    if (args[i] === argShort || args[i] === argLong) {
      arg = args[i + 1]
      break
    }
  }
  return arg
}

export function isNativeMode(args: string[]): boolean {
  return args.includes('--ide')
}

/**
 * Builds the `qodana pull` command arguments.
 * @returns The `qodana scan` command arguments.
 * @param args additional CLI arguments.
 */
export function getQodanaPullArgs(args: string[]): string[] {
  const pullArgs = ['pull']
  const linter = extractArg('-l', '--linter', args)
  if (linter) {
    pullArgs.push('-l', linter)
  }
  const project = extractArg('-i', '--project-dir', args)
  if (project) {
    pullArgs.push('-i', project)
  }
  const config = extractArg('--config', '--config', args)
  if (config) {
    pullArgs.push('--config', config)
  }
  return pullArgs
}

/**
 * Builds the `qodana scan` command arguments.
 * @param args additional CLI arguments.
 * @param resultsDir the directory to store the results.
 * @param cacheDir the directory to store the cache.
 * @returns The `qodana scan` command arguments.
 */
export function getQodanaScanArgs(
  args: string[],
  resultsDir: string,
  cacheDir: string
): string[] {
  const cliArgs: string[] = [
    'scan',
    '--cache-dir',
    cacheDir,
    '--results-dir',
    resultsDir
  ]
  if (!isNativeMode(args)) {
    cliArgs.push('--skip-pull')
  }
  if (args) {
    cliArgs.push(...args)
  }
  return cliArgs
}

export const NONE = 'none'
export const BRANCH = 'branch'
export const PULL_REQUEST = 'pull-request'
const PUSH_FIXES_TYPES = [NONE, BRANCH, PULL_REQUEST]
export type PushFixesType = (typeof PUSH_FIXES_TYPES)[number]

/**
 * The context of the current run – described in action.yaml.
 */
export interface Inputs {
  args: string[]
  resultsDir: string
  cacheDir: string
  primaryCacheKey: string
  additionalCacheKey: string
  cacheDefaultBranchOnly: boolean
  uploadResult: boolean
  uploadSarif: boolean
  artifactName: string
  useCaches: boolean
  useAnnotations: boolean
  prMode: boolean
  postComment: boolean
  githubToken: string
  pushFixes: PushFixesType
  commitMessage: string
  useNightly: boolean
}

/**
 * The test code coverage information.
 */
export interface Coverage {
  totalCoverage: number
  totalLines: number
  totalCoveredLines: number
  freshCoverage: number
  freshLines: number
  freshCoveredLines: number
}

/**
 * Read the coverage information from the SARIF file.
 * @param sarifPath the path to the SARIF file.
 */
export function getCoverageFromSarif(sarifPath: string): Coverage {
  if (fs.existsSync(sarifPath)) {
    const sarifContents = JSON.parse(
      fs.readFileSync(sarifPath, {encoding: 'utf8'})
    )
    if (sarifContents.runs[0].properties['coverage']) {
      return {
        totalCoverage:
          sarifContents.runs[0].properties['coverage']['totalCoverage'] || 0,
        totalLines:
          sarifContents.runs[0].properties['coverage']['totalLines'] || 0,
        totalCoveredLines:
          sarifContents.runs[0].properties['coverage']['totalCoveredLines'] ||
          0,
        freshCoverage:
          sarifContents.runs[0].properties['coverage']['freshCoverage'] || 0,
        freshLines:
          sarifContents.runs[0].properties['coverage']['freshLines'] || 0,
        freshCoveredLines:
          sarifContents.runs[0].properties['coverage']['freshCoveredLines'] || 0
      }
    } else {
      return {
        totalCoverage: 0,
        totalLines: 0,
        totalCoveredLines: 0,
        freshCoverage: 0,
        freshLines: 0,
        freshCoveredLines: 0
      }
    }
  }
  throw new Error(`SARIF file not found: ${sarifPath}`)
}

/**
 * Get the SHA256 checksum of the given file.
 * @param file absolute path to the file.
 */
export function sha256sum(file: string): string {
  const hash = createHash('sha256')
  hash.update(fs.readFileSync(file))
  return hash.digest('hex')
}

/**
 * Returns the message when Qodana binary is corrupted.
 * @param expected expected sha256 checksum
 * @param actual actual sha256 checksum
 */
export function getQodanaSha256MismatchMessage(
  expected: string,
  actual: string
): string {
  return `Downloaded Qodana CLI binary is corrupted. Expected SHA-256 checksum: ${expected}, actual checksum: ${actual}`
}

/**
 * Validates the given branch name.
 * @param branchName the branch name to sanitize.
 */
export function validateBranchName(branchName: string): string {
  const validBranchNameRegex = /^[a-zA-Z0-9/\-_.]+$/
  if (!validBranchNameRegex.test(branchName)) {
    throw new Error(
      `Invalid branch name: not allowed characters are used: ${branchName}`
    )
  }
  return branchName
}
