// noinspection JSUnusedGlobalSymbols

import {createHash} from 'crypto'
import {readFileSync} from 'fs'

export const SUPPORTED_PLATFORMS = ['windows', 'linux', 'darwin']
export const SUPPORTED_ARCHS = ['x86_64', 'arm64']
export const FAIL_THRESHOLD_OUTPUT =
  'The number of problems exceeds the failThreshold'
export const QODANA_SARIF_NAME = 'qodana.sarif.json'
export const QODANA_SHORT_SARIF_NAME = 'qodana-short.sarif.json'
export const VERSION = '2022.3.1'
export const EXECUTABLE = 'qodana'
export function getQodanaSha256(arch: string, platform: string): string {
  switch (`${platform}_${arch}`) {
    case 'windows_x86_64':
      return '0d5a6c3480a2fe4cda2f4b6f080467fc8c4768fe6d04ffd99bb1f578c728a204'
    case 'windows_arm64':
      return '03e2a415bf42ae354ce778b7222f9ce110b3eb7570e3eb6fda20bf9a711b5a22'
    case 'linux_x86_64':
      return 'ea8878c89d2a101229436d16420d4469197737963fc434fd4a4a9c2efaf1245b'
    case 'linux_arm64':
      return '416a8989d5295e8965066a118d092969ed64e1be20d058765ba9004460d0805d'
    case 'darwin_x86_64':
      return '8967b711b52b2e11c322a3b24ac4c98614d527039e0c6752b6da5d5e2c396dc3'
    case 'darwin_arm64':
      return 'f10c6c5e2ca3594d7fa86f01da412f1006f8acb730b623b8b68a3271a95f8e42'
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
