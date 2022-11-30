import {expect, test} from '@jest/globals'
import {parseSarif, Annotation} from '../src/output'
import {
  sha256sum,
  getQodanaSha256,
  getQodanaScanArgs,
  Inputs,
  getQodanaUrl,
  getQodanaArchiveName
} from '../../common/qodana'
import * as fs from 'fs'

// eslint-disable-next-line @typescript-eslint/no-require-imports
import path = require('path')

import * as os from 'os'

const {execSync} = require('child_process')

function outputEmptyFixture(): Annotation[] {
  return []
}

function outputDefaultFixture(): Annotation[] {
  return [
    {
      level: 'warning',
      message: "'while' has empty body",
      properties: {
        startLine: 271,
        endLine: 271,
        file: 'dokker/src/main/kotlin/io/github/tiulpin/Dokker.kt',
        title: 'Control flow with empty body',
        startColumn: undefined,
        endColumn: undefined
      }
    },
    {
      level: 'notice',
      message: "Condition is always 'true'",
      properties: {
        startLine: 268,
        endLine: 268,
        file: 'dokker/src/main/kotlin/io/github/tiulpin/Dokker.kt',
        title: "Condition of 'if' expression is constant",
        startColumn: undefined,
        endColumn: undefined
      }
    },
    {
      level: 'notice',
      message: "Might be 'const'",
      properties: {
        endLine: 283,
        file: 'dokker/src/main/kotlin/io/github/tiulpin/Dokker.kt',
        startLine: 283,
        title: "Might be 'const'",
        startColumn: undefined,
        endColumn: undefined
      }
    }
  ]
}

function inputsDefaultFixture(): Inputs {
  return {
    args: ['--baseline', 'qodana.sarif.json'],
    resultsDir: '${{ runner.temp }}/qodana-results',
    cacheDir: '${{ runner.temp }}/qodana-caches',
    additionalCacheHash: '',
    cacheDefaultBranchOnly: false,
    uploadResult: true,
    artifactName: 'Qodana report',
    useCaches: true,
    useAnnotations: true,
    prMode: true
  }
}

function defaultDockerRunCommandFixture(): string[] {
  return [
    'scan',
    '--skip-pull',
    '--cache-dir',
    '${{ runner.temp }}/qodana-caches',
    '--results-dir',
    '${{ runner.temp }}/qodana-results',
    '--baseline',
    'qodana.sarif.json'
  ]
}

test('qodana scan command args', () => {
  const inputs = inputsDefaultFixture()
  const result = getQodanaScanArgs(
    inputs.args,
    inputs.resultsDir,
    inputs.cacheDir
  )
  expect(result).toEqual(defaultDockerRunCommandFixture())
})

test('test sarif with problems to output annotations', () => {
  const output = outputDefaultFixture()
  const result = parseSarif('__tests__/data/some.sarif.json')
  expect(result).toEqual(output)
})

test('test sarif with no problems to output annotations', () => {
  const output = outputEmptyFixture()
  const result = parseSarif('__tests__/data/empty.sarif.json')
  expect(result).toEqual(output)
})

test('download all Qodana CLI archives and check their checksums', async () => {
  for (const arch of ['x86_64', 'arm64']) {
    for (const platform of ['win32', 'linux', 'darwin']) {
      const url = getQodanaUrl(arch, platform)
      const archiveName = getQodanaArchiveName(arch, platform)
      const temp = path.join(os.tmpdir(), archiveName)
      execSync(`curl -L ${url} -o ${temp}`)
      const expectedSha256 = getQodanaSha256(archiveName)
      const actualSha256 = sha256sum(temp)
      expect(`${archiveName}: ${actualSha256}`).toEqual(
        `${archiveName}: ${expectedSha256}`
      )
      fs.rmSync(temp, {force: true})
    }
  }
})
