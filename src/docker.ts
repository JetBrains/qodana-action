import * as core from '@actions/core'
import * as exec from '@actions/exec'
import {
  NOT_SUPPORTED_IMAGES,
  NOT_SUPPORTED_LINTER,
  OFFICIAL_DOCKER_PREFIX,
  UNOFFICIAL_LINTER_MESSAGE
} from './utils'
import {Inputs} from './context'

/**
 * Runs the docker command with the given arguments.
 * @param args docker command arguments.
 * @returns The docker command execution output.
 */
export async function docker(args: string[]): Promise<exec.ExecOutput> {
  return await exec.getExecOutput('docker', args, {
    ignoreReturnCode: true
  })
}

export async function dockerPull(image: string): Promise<void> {
  if (NOT_SUPPORTED_IMAGES.includes(image)) {
    throw Error(`${image} ${NOT_SUPPORTED_LINTER}`)
  }
  if (!image.startsWith(OFFICIAL_DOCKER_PREFIX)) {
    core.warning(UNOFFICIAL_LINTER_MESSAGE)
  }
  const pull = await docker(['pull', image])
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
export function getQodanaRunArgs(inputs: Inputs): string[] {
  const args: string[] = [
    'run',
    '--rm',
    '-e',
    'QODANA_ENV=github',
    '-v',
    `${inputs.cacheDir}:/data/cache`,
    '-v',
    `${inputs.projectDir}:/data/project`,
    '-v',
    `${inputs.resultsDir}:/data/results`
  ]
  if (process.platform !== 'win32') {
    args.push('-u', `${process.getuid()}:${process.getgid()}` ?? '1001:1001')
  }
  if (inputs.additionalVolumes.length > 0) {
    for (const volume of inputs.additionalVolumes) {
      args.push('-v', volume)
    }
  }
  if (inputs.additionalEnvVars.length > 0) {
    for (const envVar of inputs.additionalEnvVars) {
      args.push('-e', envVar)
    }
  }
  if (inputs.ideaConfigDir !== '') {
    args.push('-v', `${inputs.ideaConfigDir}:/root/.config/idea`)
  }
  if (inputs.gradleSettingsPath !== '') {
    args.push(
      '-v',
      `${inputs.gradleSettingsPath}:/root/.gradle/gradle.properties`
    )
  }
  args.push(`${inputs.linter}`, '--save-report')
  if (inputs.inspectedDir !== '') {
    args.push('-d', `${inputs.inspectedDir}`)
  }
  if (inputs.baselinePath !== '') {
    args.push('-b', `${inputs.baselinePath}`)
  }
  if (inputs.baselineIncludeAbsent) {
    args.push('--baseline-include-absent')
  }
  if (inputs.failThreshold !== '') {
    args.push('--fail-threshold', inputs.failThreshold)
  }
  if (inputs.profileName !== '') {
    args.push('-n', inputs.profileName)
  }
  if (inputs.profilePath !== '') {
    args.push('-p', inputs.profilePath)
  }
  if (inputs.changes) {
    args.push('--changes')
  }
  if (inputs.script !== '') {
    args.push('--script', inputs.script)
  }
  return args
}
