import {Gitlab} from '@gitbeaker/rest'
import {getEnvVariable} from './utils'

let gitlabApi: InstanceType<typeof Gitlab> | null = null

function initApi(): InstanceType<typeof Gitlab> {
  const token = getEnvVariable('QODANA_GITLAB_TOKEN')
  let host = process.env['CI_SERVER_HOST'] || 'https://gitlab.com'
  if (!host.startsWith('https://')) {
    host = `https://${host}`
  }
  const gitlab = new Gitlab({
    token: token,
    host: host
  })
  gitlabApi = gitlab
  return gitlab
}

export function getGitlabApi(): InstanceType<typeof Gitlab> {
  try {
    const api = gitlabApi
    if (!api) {
      return initApi()
    } else {
      return api
    }
  } catch (e) {
    console.error('Could not access Gitlab API')
    throw e
  }
}
