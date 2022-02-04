import * as core from '@actions/core'

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
 * The context for the action.
 * @returns The action inputs.
 */
export function getInputs(): Inputs {
  return {
    args: core.getInput('args').split(' '),
    resultsDir: core.getInput('results-dir'),
    cacheDir: core.getInput('cache-dir'),
    additionalCacheHash: core.getInput('additional-cache-hash'),
    uploadResults: core.getBooleanInput('upload-result'),
    artifactName: core.getInput('artifact-name'),
    useCaches: core.getBooleanInput('use-caches'),
    githubToken: core.getInput('github-token'),
    useAnnotations: core.getBooleanInput('use-annotations')
  }
}
