import * as core from '@actions/core'

/**
 * The context of the current run – described in action.yaml.
 */
export interface Inputs {
  linter: string
  token: string
  projectDir: string
  resultsDir: string
  cacheDir: string
  additionalCacheHash: string
  additionalVolumes: string[]
  additionalEnvVars: string[]
  inspectedDir: string
  ideaConfigDir: string
  baselinePath: string
  baselineIncludeAbsent: boolean
  failThreshold: string
  profileName: string
  profilePath: string
  gradleSettingsPath: string
  changes: boolean
  script: string
  uploadResults: boolean
  artifactName: string
  useCaches: boolean
  githubToken: string
  useAnnotations: boolean
}

/**
 * The context for the action.
 * @returns The action inputs.
 */
export function getInputs(): Inputs {
  return {
    linter: core.getInput('linter'),
    token: core.getInput('token'),
    projectDir: core.getInput('project-dir'),
    resultsDir: core.getInput('results-dir'),
    cacheDir: core.getInput('cache-dir'),
    additionalCacheHash: core.getInput('additional-cache-hash'),
    additionalVolumes: core.getMultilineInput('additional-volumes'),
    additionalEnvVars: core.getMultilineInput('additional-env-variables'),
    inspectedDir: core.getInput('inspected-dir'),
    ideaConfigDir: core.getInput('idea-config-dir'),
    baselinePath: core.getInput('baseline-path'),
    baselineIncludeAbsent: core.getBooleanInput('baseline-include-absent'),
    failThreshold: core.getInput('fail-threshold'),
    profileName: core.getInput('profile-name'),
    profilePath: core.getInput('profile-path'),
    gradleSettingsPath: core.getInput('gradle-settings-path'),
    changes: core.getBooleanInput('changes'),
    script: core.getInput('script'),
    uploadResults: core.getBooleanInput('upload-result'),
    artifactName: core.getInput('artifact-name'),
    useCaches: core.getBooleanInput('use-caches'),
    githubToken: core.getInput('github-token'),
    useAnnotations: core.getBooleanInput('use-annotations')
  }
}
