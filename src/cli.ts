import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'
import {Inputs} from './context'

const cliPath = '/home/runner/work/_temp/qodana/cli'
const version = '0.7.4'
const tool = 'qodana'

function getQodanaCliUrl(): string {
  const base = `https://github.com/JetBrains/qodana-cli/releases/download/v${version}/`
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
 * Finds linter argument in the given args, if there is one.
 * @param args qodana command arguments.
 * @returns the linter to use.
 */
function extractArgsLinter(args: string[]): string {
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
 * @returns The `qodana scan` command arguments.
 */
export function getQodanaScanArgs(inputs: Inputs): string[] {
  const cliArgs: string[] = [
    'scan',
    '--skip-pull',
    '-e',
    'QODANA_ENV=github',
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

/**
 * Runs the qodana command with the given arguments.
 * @param args docker command arguments.
 * @returns The qodana command execution output.
 */
export async function qodana(args: string[]): Promise<exec.ExecOutput> {
  return await exec.getExecOutput(tool, args, {
    ignoreReturnCode: true
  })
}

/**
 * Prepares the agent for qodana scan: install Qodana CLI and pull the linter.
 * @param args qodana arguments
 */
export async function prepareAgent(args: string[]): Promise<void> {
  const qodanaArchivePath = await tc.downloadTool(getQodanaCliUrl())
  if (process.platform === 'win32') {
    await tc.extractZip(qodanaArchivePath, cliPath)
  } else {
    await tc.extractTar(qodanaArchivePath, cliPath)
  }
  core.addPath(await tc.cacheDir(cliPath, tool, version))
  const pullArgs = ['pull']
  const linter = extractArgsLinter(args)
  if (linter) {
    pullArgs.push('-l', linter)
  }
  const pull = await qodana(pullArgs)
  if (pull.stderr.length > 0 && pull.exitCode !== 0) {
    core.setFailed(pull.stderr.trim())
    return
  }
}
