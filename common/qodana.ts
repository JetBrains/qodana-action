// noinspection JSUnusedGlobalSymbols

export const VERSION = '0.7.4'
export const EXECUTABLE = 'qodana'
export const FAIL_THRESHOLD_OUTPUT =
  'The number of problems exceeds the failThreshold'
export const QODANA_SARIF_NAME = 'qodana.sarif.json'
const QODANA_SUCCESS_EXIT_CODE = 0
const QODANA_FAILTHRESHOLD_EXIT_CODE = 255

/**
 * The context of the current run – described in action.yaml.
 */
export interface Inputs {
  args: string[]
  resultsDir: string
  cacheDir: string
  additionalCacheHash: string
  uploadResults: boolean
  artifactName: string
  useCaches: boolean
  githubToken: string
  useAnnotations: boolean
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
 * Finds linter argument in the given args, if there is one.
 * @param args qodana command arguments.
 * @returns the linter to use.
 */
export function extractArgsLinter(args: string[]): string {
  let linter = ''
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-l' || args[i] === '--linter') {
      linter = args[i + 1]
      break
    }
  }
  return linter
}

/**
 * Builds the `qodana scan` command arguments.
 * @param inputs GitHub Actions inputs.
 * @param env QODANA_ENV value
 * @returns The `qodana scan` command arguments.
 */
export function getQodanaScanArgs(inputs: Inputs, env: string = "cli"): string[] {
  const cliArgs: string[] = [
    'scan',
    '--skip-pull',
    '-e',
    `QODANA_ENV=${env}`,
    '--cache-dir',
    inputs.cacheDir,
    '--results-dir',
    inputs.resultsDir
  ]
  if (inputs.args) {
    cliArgs.push(...inputs.args)
  }
  return cliArgs
}
