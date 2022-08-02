// noinspection JSUnusedGlobalSymbols

export const VERSION = '2022.2.0'
export const EXECUTABLE = 'qodana'
export const FAIL_THRESHOLD_OUTPUT =
  'The number of problems exceeds the failThreshold'
export const QODANA_SARIF_NAME = 'qodana.sarif.json'

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
 * The context of the current run – described in action.yaml.
 */
export interface Inputs {
  args: string[]
  resultsDir: string
  cacheDir: string
  additionalCacheHash: string
  uploadResult: boolean
  artifactName: string
  useCaches: boolean
  useAnnotations: boolean
  prMode: boolean
}

/**
 * Gets Qodana CLI download URL from the GitHub Releases API.
 */
export function getQodanaCliUrl(): string {
  const base = `https://github.com/JetBrains/qodana-cli/releases/download/v${VERSION}`
  const arch = process.arch === 'x64' ? 'x86_64' : 'arm64'
  const archive = process.platform === 'win32' ? 'zip' : 'tar.gz'
  switch (process.platform) {
    case 'darwin':
      return `${base}/qodana_darwin_${arch}.${archive}`
    case 'linux':
      return `${base}/qodana_linux_${arch}.${archive}`
    case 'win32':
      return `${base}/qodana_windows_${arch}.${archive}`
    default:
      throw new Error(`Unsupported platform: ${process.platform}`)
  }
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
