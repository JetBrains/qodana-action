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
import {parseRawArguments} from '../../common/utils'
import {getGitlabApi} from './gitlabApiProvider'
import {prFixesBody} from './output'
import {DiscussionSchema} from '@gitbeaker/rest'
import * as os from 'os'
import * as fs from 'fs'
import axios from 'axios'
import * as stream from 'stream'
import {promisify} from 'util'
import AdmZip from 'adm-zip'
import * as tar from 'tar'
import path from 'path'
import {Readable} from 'stream'
import {spawn, exec} from 'child_process'

export function getInputs(): Inputs {
  const rawArgs = getQodanaStringArg('ARGS', '')
  const argList = parseRawArguments(rawArgs)

  let pushFixes = getQodanaStringArg('PUSH_FIXES', 'none')
  if (pushFixes === 'merge-request') {
    pushFixes = 'pull-request'
  }

  return {
    args: argList,
    // user given results and cache dirs are used in uploadCache, prepareCaches and uploadArtifacts
    // this hack is needed to move caches outside the project dir
    resultsDir: path.join(baseDir(), 'results'),
    cacheDir: path.join(baseDir(), 'cache'),
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
    artifactName: '',
    workingDirectory: ''
  }
}

function baseDir(): string {
  const basePath = os.tmpdir()
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

interface CommandOutput {
  returnCode: number
  stdout: string
  stderr: string
}

export async function execAsync(
  executable: string,
  args: string[],
  ignoreReturnCode: boolean
): Promise<CommandOutput> {
  const command = `${executable} ${args.join(' ')}`
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Failed to run command: ${command}: ${error.message}`)
        if (ignoreReturnCode) {
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
  })
}

async function gitOutput(
  args: string[],
  ignoreReturnCode = false
): Promise<CommandOutput> {
  return execAsync('git', args, ignoreReturnCode)
}

async function git(args: string[], ignoreReturnCode = false): Promise<number> {
  return (await gitOutput(args, ignoreReturnCode)).returnCode
}

function isMergeRequest(): boolean {
  return process.env.CI_PIPELINE_SOURCE === 'merge_request_event'
}

async function downloadTool(url: string): Promise<string> {
  const tempPath = path.join(os.tmpdir(), 'archive')
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
  const extractRoot = path.join(os.tmpdir(), 'qodana-cli')
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

export async function prepareAgent(inputs: Inputs): Promise<void> {
  // the current implementation runs in docker directly
  if (!(await isCliInstalled())) {
    await installCli(inputs.useNightly)
  }
  // we are already in docker, so we don't need to pull linter
  if (isLinuxRunner()) return

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
    updateArgsForLinuxRunner(args)

    if (inputs.prMode && isMergeRequest()) {
      const sha = await getPrSha()
      if (sha !== '') {
        args.push('--commit', sha)
      }
    }
    if (isMergeRequest()) {
      const sourceBranch =
        process.env.QODANA_BRANCH ||
        process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME
      if (sourceBranch) {
        process.env.QODANA_BRANCH = sourceBranch
      }
    }
  }
  console.log(`Running Qodana with args: ${args.join(' ')}`)
  return new Promise(resolve => {
    const proc = spawn(EXECUTABLE, args, {stdio: 'inherit'})
    proc.on('close', (code, signal) => {
      if (code == null) {
        console.error(`Qodana process terminated by signal: ${signal}`)
        resolve(1)
      } else {
        resolve(code)
      }
    })

    proc.on('error', err => {
      console.error(err.message)
      resolve(127)
    })
  })
}

function updateArgsForLinuxRunner(args: string[]): void {
  if (!isLinuxRunner()) {
    return
  }
  // in gitlab we don't perform pull
  const indexOfSkipPull = args.indexOf('--skip-pull')
  if (indexOfSkipPull !== -1) {
    args.splice(indexOfSkipPull, 1)
  }
  // Custom image - run natively
  if (process.env.QODANA_DOCKER == undefined) {
    args.push('--within-docker', 'false')
  }
}

function isLinuxRunner(): boolean {
  const os = getQodanaStringArg('RUNNER_OS', '')
  return os === 'linux'
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
  const cacheDir = getQodanaStringArg('CACHE_DIR', path.join('qodana', 'cache'))
  return path.join(process.env['CI_PROJECT_DIR'] || '.', cacheDir)
}

// at this moment any changes inside .qodana dir may affect analysis results
export async function prepareCaches(cacheDir: string): Promise<void> {
  const initialCacheLocation = getInitialCacheLocation()
  if (initialCacheLocation === cacheDir) {
    return
  }
  try {
    await fs.promises.access(initialCacheLocation)
    await fs.promises.cp(initialCacheLocation, cacheDir, {recursive: true})
  } catch (e) {
    console.debug("Couldn't restore cache:", (e as Error).message)
    console.warn(
      `Couldn't restore initial cache in ${initialCacheLocation}, skipping`
    )
  }
}

export async function uploadCache(
  cacheDir: string,
  execute: boolean
): Promise<void> {
  if (!execute) {
    return
  }
  try {
    const initialCacheLocation = getInitialCacheLocation()
    await fs.promises.rm(initialCacheLocation, {recursive: true})
    await fs.promises.cp(cacheDir, initialCacheLocation, {recursive: true})
  } catch (e) {
    console.error(`Failed to upload cache: ${(e as Error).message}`)
  }
}

export async function uploadArtifacts(resultsDir: string): Promise<void> {
  try {
    const resultDir = getQodanaStringArg(
      'RESULTS_DIR',
      path.join('.qodana', 'results')
    )
    const ciProjectDir = process.env['CI_PROJECT_DIR']
    if (!ciProjectDir) {
      console.warn('CI_PROJECT_DIR is not defined, skipping artifacts upload')
      return
    }
    const resultsArtifactPath = path.join(
      process.env['CI_PROJECT_DIR']!,
      resultDir
    )
    await fs.promises.cp(resultsDir, resultsArtifactPath, {recursive: true})
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
  return path.join(projectUrl || '', 'pipelines', pipelineId || '')
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
    let output = await gitOutput(['commit', '-m', `'${commitMessage}'`], true)
    if (output.returnCode !== 0) {
      console.warn(`Failed to commit fixes: ${output.stderr}`)
      return
    }
    output = await gitOutput(
      ['pull', '--rebase', 'origin', currentBranch],
      true
    )
    if (output.returnCode !== 0) {
      console.warn(`Failed to update branch: ${output.stderr}`)
      return
    }
    if (mode === BRANCH) {
      const commitToCherryPick = (
        await gitOutput(['rev-parse', 'HEAD'])
      ).stdout.trim()
      await git(['checkout', currentBranch])
      await git(['cherry-pick', commitToCherryPick])
      await git(['fetch', 'origin', currentBranch])
      await gitPush(currentBranch, false)
      console.log(`Pushed quick-fixes to branch ${currentBranch}`)
    } else if (mode === PULL_REQUEST) {
      const newBranch = `qodana/quick-fixes-${currentCommit.slice(0, 7)}`
      await git(['checkout', '-b', newBranch])
      await gitPush(newBranch, true)
      await createPr(commitMessage, newBranch, currentBranch)
      console.log(
        `Pushed quick-fixes to branch ${newBranch} and created pull request`
      )
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
