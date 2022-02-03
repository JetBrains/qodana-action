import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'
import {Inputs} from './context'

const cliPath = '/home/runner/work/_temp/qodana/cli'

/**
 * Runs the docker command with the given arguments.
 * @param args docker command arguments.
 * @returns The docker command execution output.
 */
export async function qodana(args: string[]): Promise<exec.ExecOutput> {
  return await exec.getExecOutput('qodana', args, {
    ignoreReturnCode: true
  })
}

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

export async function prepareAgent(
  cliVersion: string,
  args: string[]
): Promise<void> {
  const cliUrl = `https://github.com/JetBrains/qodana-cli/releases/download/v${cliVersion}/qodana_${cliVersion}_Linux_x86_64.tar.gz`
  const qodanaTarPath = await tc.downloadTool(cliUrl)
  await tc.extractTar(qodanaTarPath, cliPath)
  const cachedPath = await tc.cacheDir(cliPath, 'qodana', cliVersion)
  core.addPath(cachedPath)
  const linter = extractArgsLinter(args)
  const pullArgs = ['pull']
  if (linter) {
    pullArgs.push('-l', linter)
  }
  const pull = await qodana(pullArgs)
  if (pull.stderr.length > 0 && pull.exitCode !== 0) {
    core.setFailed(pull.stderr.trim())
    return
  }
}

/**
 * Builds the `docker run` command arguments.
 * @param inputs GitHub Actions inputs.
 * @returns The Dockers run command arguments.
 */
export function getQodanaScanArgs(inputs: Inputs): string[] {
  const cliArgs: string[] = [
    'scan',
    '-e',
    'QODANA_ENV=github',
    '--cache-dir',
    inputs.cacheDir,
    '--results-dir',
    inputs.resultsDir,
    '--skip-pull'
  ]
  if (inputs.args) {
    cliArgs.push(...inputs.args)
  }
  return cliArgs
}
