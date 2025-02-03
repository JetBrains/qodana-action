import {GitApi} from 'azure-devops-node-api/GitApi'
import * as azdev from 'azure-devops-node-api'
import {getVariable} from './utils'

let gitApi: GitApi | null = null

async function initApi(): Promise<GitApi> {
  const orgUrl = getVariable('System.TeamFoundationCollectionUri')
  const token = getVariable('System.AccessToken')
  const authHandler = azdev.getPersonalAccessTokenHandler(token)
  const webApi = new azdev.WebApi(orgUrl, authHandler)
  const api = await webApi.getGitApi()
  gitApi = api
  return api
}

export async function getGitApi(): Promise<GitApi> {
  const api = gitApi
  if (!api) {
    return await initApi()
  } else {
    return api
  }
}
