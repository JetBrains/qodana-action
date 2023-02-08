// noinspection JSUnusedGlobalSymbols

import {createHash} from 'crypto'
import {readFileSync} from 'fs'

export const SUPPORTED_PLATFORMS = ['windows', 'linux', 'darwin']
export const SUPPORTED_ARCHS = ['x86_64', 'arm64']
export const FAIL_THRESHOLD_OUTPUT =
  'The number of problems exceeds the failThreshold'
export const QODANA_SARIF_NAME = 'qodana.sarif.json'
export const QODANA_SHORT_SARIF_NAME = 'qodana-short.sarif.json'
export const VERSION = '2022.3.3'
export const EXECUTABLE = 'qodana'
export function getQodanaSha256(arch: string, platform: string): string {
  switch (`${platform}_${arch}`) {
    case 'windows_x86_64':
      return 'bfa0e823962263f8d51036f94152002efd25f6499c3394d26e962e94fe115780'
    case 'windows_arm64':
      return 'aded1dd1765ec9aff5033d9cbd49445dbd4fec13c684d2d015523bbf10f41529'
    case 'linux_x86_64':
      return '166b1f364b80c660ecd644f5c3009fb677bbeae33f58bc5e9e28a3dc6988eb6c'
    case 'linux_arm64':
      return '81422f12bccb67dfaa8ab6994a8a5e076d95b39a5ef95b0481d6a2e40c76fc53'
    case 'darwin_x86_64':
      return 'aa6e2498803cb3c1f2def8bbe7e439e3887e1aac609ca243e0e341cd360d0c91'
    case 'darwin_arm64':
      return '8acc312a46821cf90f94be94b22582fc1aa19a443a80952a292f1fb1c00946d1'
    default:
      throw new Error(`Qodana CLI does not exist for ${platform}_${arch}`)
  }
}

/**
 * Returns the architecture name suitable for the published Qodana CLI archive name.
 */
export function getProcessArchName(): string {
  return process.arch === 'x64' ? 'x86_64' : 'arm64'
}

/**
 * Returns the platform name suitable for the published Qodana CLI archive name.
 */
export function getProcessPlatformName(): string {
  return process.platform === 'win32' ? 'windows' : process.platform
}

/**
 * Gets Qodana CLI download URL from the GitHub Releases API.
 */
export function getQodanaUrl(arch: string, platform: string): string {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`)
  }
  if (!SUPPORTED_ARCHS.includes(arch)) {
    throw new Error(`Unsupported architecture: ${arch}`)
  }
  const archive = platform === 'windows' ? 'zip' : 'tar.gz'
  return `https://github.com/JetBrains/qodana-cli/releases/download/v${VERSION}/qodana_${platform}_${arch}.${archive}`
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
 * Finds the wanted argument value in the given args, if there is one.
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
    '--skip-pull',
    '--cache-dir',
    cacheDir,
    '--results-dir',
    resultsDir
  ]
  if (args) {
    cliArgs.push(...args)
  }
  return cliArgs
}

/**
 * The context of the current run – described in action.yaml.
 */
export interface Inputs {
  args: string[]
  resultsDir: string
  cacheDir: string
  additionalCacheHash: string
  cacheDefaultBranchOnly: boolean
  uploadResult: boolean
  artifactName: string
  useCaches: boolean
  useAnnotations: boolean
  prMode: boolean
}

/**
 * Get the SHA256 checksum of the given file.
 * @param file absolute path to the file.
 */
export function sha256sum(file: string): string {
  const hash = createHash('sha256')
  hash.update(readFileSync(file))
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
