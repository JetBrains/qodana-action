import {
  BRANCH,
  EXECUTABLE,
  getProcessArchName,
  getProcessPlatformName,
  getQodanaPullArgs,
  getQodanaScanArgs,
  getQodanaUrl,
  Inputs,
  isNativeMode,
  NONE,
  PULL_REQUEST,
  PushFixesType,
  validateBranchName
} from '../../common/qodana'
import {COMMIT_EMAIL, COMMIT_USER, getCommentTag} from '../../common/output'
import * as os from 'os'
import {exec} from 'child_process'
import * as fs from 'fs'
import axios from 'axios'
import * as stream from 'stream'
import {promisify} from 'util'
import AdmZip from 'adm-zip'
import * as tar from 'tar'
import {DiscussionSchema} from '@gitbeaker/rest'
import {getGitlabApi} from './gitlabApiProvider'
import {prFixesBody} from './output'
import path from 'path'
import {Readable} from 'stream'

export function getInputs(): Inputs {
  const rawArgs = getQodanaStringArg('ARGS', '')
  const argList =
    rawArgs !== '' ? rawArgs.split(',').map(arg => arg.trim()) : []

  let pushFixes = getQodanaStringArg('PUSH_FIXES', 'none')
  if (pushFixes === 'merge-request') {
    pushFixes = 'pull-request'
  }

  return {
    args: argList,
    // user given results and cache dirs are used in uploadCache, prepareCaches and uploadArtifacts
    resultsDir: `${baseDir()}/results`,
    cacheDir: `${baseDir()}/cache`,
    uploadResult: getQodanaBooleanArg('UPLOAD_RESULT', false),
    prMode: getQodanaBooleanArg('MR_MODE', true),
    pushFixes: pushFixes,
    commitMessage: getQodanaStringArg(
      'COMMIT_MESSAGE',
      '🤖 Apply quick-fixes by Qodana'
    ),
    useNightly: getQodanaBooleanArg('USE_NIGHTLY', false),
    postComment: getQodanaBooleanArg('PUBLISH_COMMENT', true),
    useCaches: getQodanaBooleanArg('USE_CACHES', true),
    // not used by GitLab
    uploadSarif: false,
    useAnnotations: false,
    additionalCacheKey: '',
    primaryCacheKey: '',
    cacheDefaultBranchOnly: false,
    githubToken: '',
    artifactName: ''
  }
}

function baseDir(): string {
  const basePath = process.env.CI_BUILDS_DIR || os.tmpdir()
  return `${basePath}/.qodana`
}

function getQodanaStringArg(name: string, def: string): string {
  return process.env[`QODANA_${name}`] || def
}

function getQodanaBooleanArg(name: string, def: boolean): boolean {
  return def
    ? process.env[`QODANA_${name}`] !== 'false'
    : process.env[`QODANA_${name}`] === 'true'
}

function getQodanaInputArg(name: string): string | undefined {
  return process.env[`INPUT_${name}`]
}

interface CommandOutput {
  returnCode: number
  stdout: string
  stderr: string
}

interface ExecOptions {
  streamStdoutLive?: boolean
  ignoreReturnCode?: boolean
}

export async function execAsync(
  executable: string,
  args: string[],
  options: ExecOptions = {}
): Promise<CommandOutput> {
  const command = `${executable} ${args.join(' ')}`
  return new Promise((resolve, reject) => {
    const proc = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Failed to run command: ${command}: ${error.message}`)
        if (options.ignoreReturnCode) {
          resolve({
            returnCode: error.code || -1,
            stdout: stdout,
            stderr: stderr
          })
        }
        reject(new Error(stderr))
      } else {
        resolve({
          returnCode: 0,
          stdout: stdout,
          stderr: stderr
        })
      }
    })
    if (options?.streamStdoutLive) {
      proc.stdout?.pipe(process.stdout)
      proc.stderr?.pipe(process.stderr)
    }
  })
}

async function gitOutput(
  args: string[],
  options: ExecOptions = {}
): Promise<CommandOutput> {
  return execAsync('git', args, options)
}

async function git(args: string[], options: ExecOptions = {}): Promise<number> {
  return (await gitOutput(args, options)).returnCode
}

function isMergeRequest(): boolean {
  return process.env.CI_PIPELINE_SOURCE === 'merge_request_event'
}

async function downloadTool(url: string): Promise<string> {
  const tempPath = `${os.tmpdir()}/archive`
  const writer = fs.createWriteStream(tempPath)
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  })
  const data = response.data as Readable
  data.pipe(writer)
  await promisify(stream.finished)(writer)
  return tempPath
}

export async function isCliInstalled(): Promise<boolean> {
  return new Promise(resolve => {
    exec('qodana -v', error => {
      if (error) {
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

export async function installCli(useNightly: boolean): Promise<void> {
  const arch = getProcessArchName()
  const platform = getProcessPlatformName()
  const temp = await downloadTool(getQodanaUrl(arch, platform, useNightly))
  const extractRoot = `${os.tmpdir()}/qodana-cli`
  fs.mkdirSync(extractRoot, {recursive: true})
  if (process.platform === 'win32') {
    const zip = new AdmZip(temp)
    zip.extractAllTo(extractRoot, true)
  } else {
    await tar.x({
      C: extractRoot,
      f: temp
    })
  }
  const separator = process.platform === 'win32' ? ';' : ':'
  process.env.PATH = process.env.PATH + separator + extractRoot
}

export async function prepareAgent(
  inputs: Inputs,
  useNightly: boolean
): Promise<void> {
  if (!(await isCliInstalled())) {
    await installCli(useNightly)
  }
  if (!isNativeMode(inputs.args)) {
    const pull = await qodana(getQodanaPullArgs(inputs.args))
    if (pull !== 0) {
      throw new Error("Unable to run 'qodana pull' to download linter")
    }
  }
}

export async function qodana(args: string[] = []): Promise<number> {
  process.env = {
    ...process.env,
    NONINTERACTIVE: '1'
  }
  if (args.length === 0) {
    const inputs = getInputs()
    args = getQodanaScanArgs(inputs.args, inputs.resultsDir, inputs.cacheDir)
    if (inputs.prMode && isMergeRequest()) {
      const sha = await getPrSha()
      if (sha !== '') {
        args.push('--commit', sha)
      }
      const sourceBranch =
        process.env.QODANA_BRANCH ||
        process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME
      if (sourceBranch) {
        process.env.QODANA_BRANCH = sourceBranch
      }
    }
  }
  return (
    await execAsync(EXECUTABLE, args, {
      streamStdoutLive: true,
      ignoreReturnCode: true
    })
  ).returnCode
}

async function getPrSha(): Promise<string> {
  try {
    if (process.env.QODANA_PR_SHA) {
      return process.env.QODANA_PR_SHA
    }
    if (isMergeRequest()) {
      const sourceBranch = process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME
      const targetBranch = process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME
      if (!sourceBranch || !targetBranch) {
        console.warn(
          `Source or target branch is not defined, falling back to regular scan`
        )
        return ''
      }
      await gitOutput(['fetch', 'origin'])
      const output = await gitOutput([
        'merge-base',
        'origin/' + targetBranch,
        'origin/' + sourceBranch
      ])
      return output.stdout.trim()
    }
    return ''
  } catch (e) {
    console.warn(
      `Failed to determine merge base for PR mode, falling back to regular scan: ${(e as Error).message}`
    )
    return ''
  }
}

function getInitialCacheLocation(): string {
  return (
    getQodanaInputArg('CACHE_DIR') ||
    `${process.env['CI_PROJECT_DIR']}/.qodana/cache`
  )
}

// at this moment any changes inside .qodana dir may affect analysis results
export function prepareCaches(cacheDir: string): void {
  const initialCacheLocation = getInitialCacheLocation()
  if (fs.existsSync(initialCacheLocation)) {
    fs.cpSync(initialCacheLocation, cacheDir, {recursive: true})
    fs.rmSync(initialCacheLocation, {recursive: true})
  }
}

export function uploadCache(cacheDir: string, execute: boolean): void {
  if (!execute) {
    return
  }
  try {
    const initialCacheLocation = getInitialCacheLocation()
    fs.cpSync(cacheDir, initialCacheLocation, {recursive: true})
  } catch (e) {
    console.error(`Failed to upload cache: ${(e as Error).message}`)
  }
}

export function uploadArtifacts(resultsDir: string, execute: boolean): void {
  if (!execute) {
    return
  }
  try {
    const resultDir = getQodanaInputArg('RESULTS_DIR')
    const ciProjectDir = process.env['CI_PROJECT_DIR']
    if (!ciProjectDir) {
      console.warn('CI_PROJECT_DIR is not defined, skipping artifacts upload')
      return
    }
    const resultsArtifactPath = path.join(
      process.env['CI_PROJECT_DIR']!,
      resultDir ? resultDir : '.qodana/results'
    )
    fs.cpSync(resultsDir, resultsArtifactPath, {recursive: true})
  } catch (e) {
    console.error(`Failed to upload artifacts: ${(e as Error).message}`)
  }
}

export function getWorkflowRunUrl(): string {
  const projectUrl = process.env['CI_PROJECT_URL']
  const pipelineId = process.env['CI_PIPELINE_ID']
  if (!projectUrl || !pipelineId) {
    console.warn(
      'CI_PROJECT_URL or CI_PIPELINE_ID is not defined, the pipeline url will be invalid'
    )
  }
  return `${projectUrl}/pipelines/${pipelineId}`
}

export async function postResultsToPRComments(
  toolName: string,
  sourceDir: string,
  content: string,
  hasIssues: boolean,
  postComment: boolean
): Promise<void> {
  if (!postComment) {
    return
  }
  try {
    const comment_tag_pattern = getCommentTag(toolName, sourceDir)
    const body = `${content}\n${comment_tag_pattern}`

    const result = await findCommentByTag(comment_tag_pattern)
    let discussionId = result.discussionId
    const noteId = result.noteId

    const api = getGitlabApi()
    const mergeRequestId = getEnvVariable('CI_MERGE_REQUEST_IID')
    const projectId = getEnvVariable('CI_PROJECT_ID')
    if (discussionId === undefined || noteId === undefined) {
      discussionId = (
        await api.MergeRequestDiscussions.create(
          projectId,
          mergeRequestId,
          body
        )
      ).id
    } else {
      await api.MergeRequestDiscussions.editNote(
        projectId,
        mergeRequestId,
        discussionId,
        noteId,
        {
          body: body
        }
      )
    }
    await api.MergeRequestDiscussions.resolve(
      projectId,
      mergeRequestId,
      discussionId,
      !hasIssues
    )
  } catch (e) {
    console.warn(`Was not able to post comment to PR: ${(e as Error).message}`)
  }
}

export async function findCommentByTag(tag: string): Promise<{
  discussionId: string | undefined
  noteId: number | undefined
}> {
  try {
    const api = getGitlabApi()
    const mergeRequestId = getEnvVariable('CI_MERGE_REQUEST_IID')
    const projectId = getEnvVariable('CI_PROJECT_ID')
    const discussions = (await api.MergeRequestDiscussions.all(
      projectId,
      mergeRequestId
    )) as DiscussionSchema[]

    for (const discussion of discussions) {
      if (discussion.notes === undefined) continue
      const note = discussion.notes.find(note => note.body.includes(tag))
      if (note)
        return {
          discussionId: discussion.id,
          noteId: note.id
        }
    }
    return {
      discussionId: undefined,
      noteId: undefined
    }
  } catch (e) {
    console.error('Error occurred while finding comment produced by Qodana')
    throw e
  }
}

export function getEnvVariable(name: string): string {
  const result = process.env[name]
  if (!result) {
    throw new Error(`Variable ${name} is not set`)
  }
  return result
}

export async function pushQuickFixes(
  mode: PushFixesType,
  commitMessage: string
): Promise<void> {
  if (mode === NONE) {
    return
  }
  try {
    let currentBranch
    if (isMergeRequest()) {
      currentBranch = getEnvVariable('CI_MERGE_REQUEST_SOURCE_BRANCH_NAME')
    } else {
      currentBranch = getEnvVariable('CI_COMMIT_BRANCH')
    }
    currentBranch = validateBranchName(currentBranch)
    const currentCommit = (await gitOutput(['rev-parse', 'HEAD'])).stdout.trim()
    await git(['config', 'user.name', COMMIT_USER])
    await git(['config', 'user.email', COMMIT_EMAIL])
    await git(['add', '.'])
    commitMessage = commitMessage + '\n\n[skip-ci]'
    let output = await gitOutput(['commit', '-m', `'${commitMessage}'`], {
      ignoreReturnCode: true
    })
    if (output.returnCode !== 0) {
      console.warn(`Failed to commit fixes: ${output.stderr}`)
      return
    }
    output = await gitOutput(['pull', '--rebase', 'origin', currentBranch], {
      ignoreReturnCode: true
    })
    if (output.returnCode !== 0) {
      console.warn(`Failed to update branch: ${output.stderr}`)
      return
    }
    if (mode === BRANCH) {
      if (isMergeRequest()) {
        const commitToCherryPick = (
          await gitOutput(['rev-parse', 'HEAD'])
        ).stdout.trim()
        await git(['checkout', currentBranch])
        await git(['cherry-pick', commitToCherryPick])
      }
      await gitPush(currentBranch, false)
    } else if (mode === PULL_REQUEST) {
      const newBranch = `qodana/quick-fixes-${currentCommit.slice(0, 7)}`
      await git(['checkout', '-b', newBranch])
      await gitPush(newBranch, true)
      await createPr(commitMessage, newBranch, currentBranch)
    }
  } catch (e) {
    console.warn(`Failed to push quick fixes – ${(e as Error).message}`)
  }
}

async function gitPush(branch: string, force: boolean): Promise<void> {
  const gitRepo = (
    await gitOutput(['config', '--get', 'remote.origin.url'])
  ).stdout
    .trim()
    .replace('git@', '')
  const url = `https://${COMMIT_USER}:${process.env.QODANA_GITLAB_TOKEN}@${gitRepo.split('@')[1]}`
  if (force) {
    await git(['push', '--force', '-o', 'ci.skip', url, branch])
  } else {
    await git(['push', '-o', 'ci.skip', url, branch])
  }
}

async function createPr(
  commitMessage: string,
  sourceBranch: string,
  targetBranch: string
): Promise<void> {
  const api = getGitlabApi()
  const projectId = getEnvVariable('CI_PROJECT_ID')
  const description = prFixesBody(getWorkflowRunUrl())
  try {
    await api.MergeRequests.create(
      projectId,
      sourceBranch,
      targetBranch,
      commitMessage,
      {description: description}
    )
  } catch (e) {
    console.error(`Failed to create PR: ${(e as Error).message}`)
  }
}
