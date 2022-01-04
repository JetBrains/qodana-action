import * as exec from '@actions/exec'
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

/**
 * Builds the `docker run` command arguments.
 * @param inputs GitHub Actions inputs.
 * @returns The Docker run command arguments.
 */
export function getQodanaRunArgs(inputs: Inputs): string[] {
  const args: string[] = [
    'run',
    '--rm',
    '-e',
    'CI=GITHUB',
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
