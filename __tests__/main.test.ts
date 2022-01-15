import {expect, test} from '@jest/globals'
import {Output, parseSarif} from '../src/annotations'
import {Inputs} from '../src/context'
import {dockerPull, getQodanaRunArgs} from '../src/docker'
import {QODANA_CHECK_NAME, QODANA_HELP_STRING} from '../src/utils'

function outputEmptyFixture(): Output {
  return {
    annotations: [],
    summary: 'No problems found.',
    text: QODANA_HELP_STRING,
    title: QODANA_CHECK_NAME
  }
}

function outputDefaultFixture(): Output {
  return {
    annotations: [
      {
        annotation_level: 'warning',
        start_line: 271,
        end_line: 271,
        message: "'while' has empty body",
        path: 'dokker/src/main/kotlin/io/github/tiulpin/Dokker.kt',
        title: 'Control flow with empty body',
        start_column: undefined,
        end_column: undefined
      },
      {
        annotation_level: 'notice',
        start_line: 268,
        end_line: 268,
        message: "Condition is always 'true'",
        path: 'dokker/src/main/kotlin/io/github/tiulpin/Dokker.kt',
        title: "Condition of 'if' expression is constant",
        start_column: undefined,
        end_column: undefined
      },
      {
        annotation_level: 'notice',
        end_line: 283,
        message: "Might be 'const'",
        path: 'dokker/src/main/kotlin/io/github/tiulpin/Dokker.kt',
        start_line: 283,
        title: "Might be 'const'",
        start_column: undefined,
        end_column: undefined
      }
    ],
    summary: '3 problems were detected.',
    text: QODANA_HELP_STRING,
    title: QODANA_CHECK_NAME
  }
}

function inputsDefaultFixture(): Inputs {
  return {
    linter: 'jetbrains/qodana-jvm-community',
    projectDir: '${{ github.workspace }}',
    resultsDir: '${{ runner.temp }}/qodana-results',
    cacheDir: '${{ runner.temp }}/qodana-caches',
    additionalCacheHash: '',
    additionalVolumes: ['/tmp/project:/data/project'],
    additionalEnvVars: ['TESTS=1', 'RANDOM_SEED=42'],
    inspectedDir: '',
    ideaConfigDir: '',
    baselinePath: '',
    baselineIncludeAbsent: false,
    failThreshold: '10',
    profileName: 'qodana.recommended',
    profilePath: '',
    gradleSettingsPath: '',
    changes: false,
    script: '',
    uploadResults: true,
    artifactName: 'Qodana report',
    useCaches: true,
    useAnnotations: true,
    githubToken: ''
  }
}

function defaultDockerRunCommandFixture(): string[] {
  let args = [
    'run',
    '--rm',
    '-e',
    'QODANA_ENV=github',
    '-v',
    '${{ runner.temp }}/qodana-caches:/data/cache',
    '-v',
    '${{ github.workspace }}:/data/project',
    '-v',
    '${{ runner.temp }}/qodana-results:/data/results'
  ]
  if (process.platform !== 'win32') {
    args.push('-u', `${process.getuid()}:${process.getgid()}` ?? '1001:1001')
  }
  args.push(
    '-v',
    '/tmp/project:/data/project',
    '-e',
    'TESTS=1',
    '-e',
    'RANDOM_SEED=42',
    'jetbrains/qodana-jvm-community',
    '--save-report',
    '--fail-threshold',
    '10',
    '-n',
    'qodana.recommended'
  )
  return args
}

test('docker run command args', () => {
  const inputs = inputsDefaultFixture()
  const result = getQodanaRunArgs(inputs)
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

test('fail pulling unsuppored linter', async () => {
  const inputs = inputsDefaultFixture()
  inputs.linter = 'jetbrains/qodana-clone-finder'
  await expect(dockerPull(inputs.linter)).rejects.toThrow()
})
