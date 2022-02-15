import {expect, test} from '@jest/globals'
import {
  Output,
  parseSarif,
  QODANA_HELP_STRING,
  QODANA_CHECK_NAME
} from '../src/annotations'
import {getQodanaScanArgs, Inputs, VERSION} from '../../common/qodana'

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
    args: ['--baseline', 'qodana.sarif.json'],
    resultsDir: '${{ runner.temp }}/qodana-results',
    cacheDir: '${{ runner.temp }}/qodana-caches',
    additionalCacheHash: '',
    uploadResult: true,
    artifactName: 'Qodana report',
    useCaches: true,
    useAnnotations: true,
    githubToken: ''
  }
}

function defaultDockerRunCommandFixture(): string[] {
  return [
    'scan',
    '--skip-pull',
    '-e',
    `QODANA_ENV=github:${VERSION}`,
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
    inputs.cacheDir,
    'github'
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
