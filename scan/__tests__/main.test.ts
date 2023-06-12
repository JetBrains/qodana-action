import {expect, test} from '@jest/globals'
import {
  sha256sum,
  getQodanaSha256,
  getQodanaScanArgs,
  Inputs,
  getQodanaUrl,
  VERSION,
  SUPPORTED_PLATFORMS,
  SUPPORTED_ARCHS
} from '../../common/qodana'
import * as fs from 'fs'

// eslint-disable-next-line @typescript-eslint/no-require-imports
import path = require('path')

import * as os from 'os'
import {Annotation, parseSarif} from '../src/annotations'

const {execSync} = require('child_process')

function outputEmptyFixture(): Annotation[] {
  return []
}

function annotationsDefaultFixture(): Annotation[] {
  return [
    {
      annotation_level: 'warning',
      message: "'while' has empty body",
      start_line: 271,
      end_line: 271,
      path: 'dokker/src/main/kotlin/io/github/tiulpin/Dokker.kt',
      title: 'Control flow with empty body',
      start_column: undefined,
      end_column: undefined
    },
    {
      annotation_level: 'notice',
      message: "Condition is always 'true'",
      start_line: 268,
      end_line: 268,
      path: 'dokker/src/main/kotlin/io/github/tiulpin/Dokker.kt',
      title: "Condition of 'if' expression is constant",
      start_column: undefined,
      end_column: undefined
    },
    {
      annotation_level: 'notice',
      message: "Might be 'const'",
      end_line: 283,
      path: 'dokker/src/main/kotlin/io/github/tiulpin/Dokker.kt',
      start_line: 283,
      title: "Might be 'const'",
      start_column: undefined,
      end_column: undefined
    }
  ]
}

function inputsDefaultFixture(): Inputs {
  return {
    args: ['--baseline', 'qodana.sarif.json'],
    resultsDir: '${{ runner.temp }}/qodana-results',
    cacheDir: '${{ runner.temp }}/qodana-caches',
    additionalCacheKey: '',
    primaryCacheKey: '',
    cacheDefaultBranchOnly: false,
    uploadResult: false,
    uploadSarif: true,
    artifactName: 'Qodana report',
    useCaches: true,
    useAnnotations: true,
    prMode: true,
    githubToken: ''
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
  const output = annotationsDefaultFixture()
  const result = parseSarif('__tests__/data/some.sarif.json')
  expect(result.annotations).toEqual(output)
})

test('test sarif with no problems to output annotations', () => {
  const output = outputEmptyFixture()
  const result = parseSarif('__tests__/data/empty.sarif.json')
  expect(result.annotations).toEqual(output)
})

test('check whether action README.md has the latest version mentioned everywhere', () => {
  const readmeMd = fs.readFileSync(
    path.join(__dirname, '..', '..', 'README.md'),
    'utf8'
  )
  const mentions =
    readmeMd.match(/uses: JetBrains\/qodana-action@v\d+\.\d+\.\d+/g) || []
  expect(mentions.length > 0).toEqual(true)
  for (const mention of mentions) {
    expect(mention).toEqual(`uses: JetBrains/qodana-action@v${VERSION}`)
  }
})

test('check whether Azure Pipelines task.json definitions is up to date', () => {
  const taskJson = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', '..', 'vsts', 'QodanaScan', 'task.json'),
      'utf8'
    )
  )
  expect(
    `${taskJson.version.Major}.${taskJson.version.Minor}.${taskJson.version.Patch}`
  ).toEqual(VERSION)
})

test('check whether Azure Pipelines README.md has the latest major version mentioned', () => {
  const readmeMd = fs.readFileSync(
    path.join(__dirname, '..', '..', 'vsts', 'README.md'),
    'utf8'
  )
  const mentions = readmeMd.match(/ - task: QodanaScan@\d+/g) || []
  expect(mentions.length > 0).toEqual(true)
  for (const mention of mentions) {
    expect(mention).toEqual(` - task: QodanaScan@${VERSION.split('.')[0]}`)
  }
})

test('check whether CircleCI orb definition contains the latest version', () => {
  const orb = path.join(__dirname, '..', '..', 'src', 'commands', 'scan.yml')
  const example = path.join(
    __dirname,
    '..',
    '..',
    'src',
    'examples',
    'scan.yml'
  )
  for (const orbFile of [orb, example]) {
    const orbFileContent = fs.readFileSync(orbFile, 'utf8')
    const mentions = orbFileContent.match(/\d+\.\d+\.\d+/g) || []
    expect(mentions.length > 0).toEqual(true)
    for (const mention of mentions) {
      expect(mention).toEqual(VERSION)
    }
  }
})

test('download all Qodana CLI archives and check their checksums', async () => {
  for (const arch of SUPPORTED_ARCHS) {
    for (const platform of SUPPORTED_PLATFORMS) {
      const url = getQodanaUrl(arch, platform)
      const archiveName = `${platform}_${arch}`
      const temp = path.join(os.tmpdir(), archiveName)
      execSync(`curl -L ${url} -o ${temp}`)
      const expectedSha256 = getQodanaSha256(arch, platform)
      const actualSha256 = sha256sum(temp)
      expect(`${archiveName}: ${actualSha256}`).toEqual(
        `${archiveName}: ${expectedSha256}`
      )
      fs.rmSync(temp, {force: true})
    }
  }
})
