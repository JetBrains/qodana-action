import {afterAll, beforeEach, expect, jest, test} from '@jest/globals'
import * as commonOutput from '../../common/output'
import * as qodana from '../../common/qodana'
import {publishOutput} from '../src/output'
import * as gitlabUtils from '../src/utils'

const postCommentSpy = jest
  .spyOn(gitlabUtils, 'postResultsToPRComments')
  .mockResolvedValue()
jest.spyOn(commonOutput, 'parseSarif').mockReturnValue({
  title: 'No new problems found by Qodana for JS',
  summary: 'No new problems found by Qodana for JS',
  text: 'This result was published with Qodana',
  problemDescriptions: []
})
jest.spyOn(qodana, 'getCoverageFromSarif').mockReturnValue({
  totalCoverage: 0,
  totalLines: 0,
  totalCoveredLines: 0,
  freshCoverage: 0,
  freshLines: 0,
  freshCoveredLines: 0,
  totalCoverageThreshold: 50,
  freshCoverageThreshold: 50
})

jest.replaceProperty(process, 'env', {
  ...process.env,
  CI_PROJECT_URL: 'https://gitlab.example.com/group/project',
  CI_PIPELINE_ID: '123'
})

afterAll(() => {
  jest.restoreAllMocks()
})

beforeEach(() => {
  jest.clearAllMocks()
})

test.each([
  {
    name: 'MR pipeline, MR mode enabled, comments enabled',
    pipelineSource: 'merge_request_event',
    mrMode: true,
    postComment: true,
    shouldPost: true
  },
  {
    name: 'MR pipeline, full project analysis, comments enabled',
    pipelineSource: 'merge_request_event',
    mrMode: false,
    postComment: true,
    shouldPost: true
  },
  {
    name: 'MR pipeline, MR mode enabled, comments disabled',
    pipelineSource: 'merge_request_event',
    mrMode: true,
    postComment: false,
    shouldPost: false
  },
  {
    name: 'MR pipeline, full project analysis, comments disabled',
    pipelineSource: 'merge_request_event',
    mrMode: false,
    postComment: false,
    shouldPost: false
  },
  {
    name: 'push pipeline, full project analysis, comments enabled',
    pipelineSource: 'push',
    mrMode: false,
    postComment: true,
    shouldPost: false
  },
  {
    name: 'push pipeline, full project analysis, comments disabled',
    pipelineSource: 'push',
    mrMode: false,
    postComment: false,
    shouldPost: false
  }
])('$name', async ({pipelineSource, mrMode, postComment, shouldPost}) => {
  process.env.CI_PIPELINE_SOURCE = pipelineSource

  await publishOutput(
    'frontend',
    'src',
    '/no-such-qodana-results',
    postComment,
    mrMode,
    true
  )

  expect(postCommentSpy).toHaveBeenCalledTimes(shouldPost ? 1 : 0)
})

test('does not post when execute is false', async () => {
  process.env.CI_PIPELINE_SOURCE = 'merge_request_event'

  await publishOutput(
    'frontend',
    'src',
    '/no-such-qodana-results',
    true,
    true,
    false
  )

  expect(postCommentSpy).not.toHaveBeenCalled()
})
