// noinspection JSUnusedGlobalSymbols

import {createHash} from 'crypto'
import {readFileSync} from 'fs'

export const FAIL_THRESHOLD_OUTPUT =
  'The number of problems exceeds the failThreshold'
export const QODANA_SARIF_NAME = 'qodana.sarif.json'
export const QODANA_SHORT_SARIF_NAME = 'qodana-short.sarif.json'
export const VERSION = '2022.2.4'
export const EXECUTABLE = 'qodana'
export function getQodanaSha256(archiveName: string): string {
  switch (archiveName) {
    case 'windows_x86_64':
      return '343c7a5e16263ffff12933b96cb6647af338faf3e001b5b66e90b225cd81755b'
    case 'windows_arm64':
      return '77f2918fb97930384f08521bd051b103a5d1852e6b72bddf5f0244d7fa12698c'
    case 'linux_x86_64':
      return '7f0e89e882ffe036aea025c6e7849049bbaac41b1f8ff0f55e20b6bd68ce6164'
    case 'linux_arm64':
      return 'b400cf6f8c2e39fd5cad6954be695dc46bf6070ce342a96ab46101bed0a1adaa'
    case 'darwin_x86_64':
      return 'f18e55335270e612cf2ef9e33d854cfc86c31b76c4ccc881b8d8b5819cedbc69'
    case 'darwin_arm64':
      return 'f69c832feb2c223bfa209fc38262e8559e049dca48ca7b387f7aa19b8fa6d637'
    default:
      throw new Error(`Qodana CLI does not exist for ${archiveName}`)
  }
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

export function getQodanaArchiveName(arch = '', platform = ''): string {
  if (arch === '') {
    arch = process.arch === 'x64' ? 'x86_64' : 'arm64'
  }
  if (platform === '') {
    platform = process.platform
  }
  switch (platform) {
    case 'win32':
      return `windows_${arch}`
    case 'linux':
      return `linux_${arch}`
    case 'darwin':
      return `darwin_${arch}`
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
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
 * Gets Qodana CLI download URL from the GitHub Releases API.
 */
export function getQodanaUrl(arch = '', platform = ''): string {
  if (arch === '') {
    arch = process.arch === 'x64' ? 'x86_64' : 'arm64'
  }
  if (platform === '') {
    platform = process.platform
  }
  const archive = platform === 'win32' ? 'zip' : 'tar.gz'
  return `https://github.com/JetBrains/qodana-cli/releases/download/v${VERSION}/qodana_${getQodanaArchiveName(
    arch,
    platform
  )}.${archive}`
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
