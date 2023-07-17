import {expect, test} from '@jest/globals'
import {AnnotationProperties} from '@actions/core'
import {
  getCoverageFromSarif,
  getQodanaScanArgs,
  Inputs
} from '../../common/qodana'
import {
  Annotation,
  getGitHubCheckConclusion,
  parseSarif,
  toAnnotationProperties
} from '../src/annotations'
import {getSummary, getCoverageStats} from '../src/output'

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

test('test typical summary output', () => {
  const result = getSummary(
    'Qodana for JS',
    annotationsDefaultFixture().reverse(), // reversed for testing the correct sorting in output
    '',
    'There is no licenses information available',
    'https://example.com/report',
    true
  )
  expect(result).toEqual(markdownSummaryFixture())
})

test('test empty summary output', () => {
  const result = getSummary(
    'Qodana for JS',
    outputEmptyFixture(),
    '',
    '',
    '',
    false
  )
  expect(result).toEqual(markdownEmptySummaryFixture())
})

test('test passed coverage output', () => {
  const result = getCoverageStats(
    getCoverageFromSarif('__tests__/data/some.sarif.json'),
    50
  )
  expect(result).toEqual(passedCoverageFixture())
})

test('test failed coverage output', () => {
  const result = getCoverageStats(
    getCoverageFromSarif('__tests__/data/empty.sarif.json'),
    50
  )
  expect(result).toEqual(failedCoverageFixture())
})

test('check conversion from Checks API Annotations to actions/core AnnotationProperty', () => {
  const result = toAnnotationProperties(annotationsDefaultFixture()[0])
  expect(result).toEqual(annotationPropertyDefaultFixture())
})

test('check failure conclusion for the Check', () => {
  const result = getGitHubCheckConclusion(annotationsDefaultFixture(), true)
  expect(result).toEqual('failure')
})

test('check neutral conclusion for the Check', () => {
  const result = getGitHubCheckConclusion(annotationsDefaultFixture(), false)
  expect(result).toEqual('neutral')
})

test('check success conclusion for the Check', () => {
  const result = getGitHubCheckConclusion(outputEmptyFixture(), false)
  expect(result).toEqual('success')
})

export function outputEmptyFixture(): Annotation[] {
  return []
}

export function annotationsDefaultFixture(): Annotation[] {
  return [
    {
      annotation_level: 'failure',
      message: "'while' has empty body",
      start_line: 271,
      end_line: 271,
      path: 'dokker/src/main/kotlin/io/github/tiulpin/Dokker.kt',
      title: 'Control flow with empty body',
      start_column: undefined,
      end_column: undefined
    },
    {
      annotation_level: 'warning',
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

export function annotationPropertyDefaultFixture(): AnnotationProperties {
  return {
    title: 'Control flow with empty body',
    file: 'dokker/src/main/kotlin/io/github/tiulpin/Dokker.kt',
    startLine: 271,
    endLine: 271,
    startColumn: undefined,
    endColumn: undefined
  }
}

export function inputsDefaultFixture(): Inputs {
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
    postComment: true,
    githubToken: '',
    pushFixes: 'none',
    commitMessage: ''
  }
}

export function defaultDockerRunCommandFixture(): string[] {
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

export function markdownSummaryFixture(): string {
  return `# [Qodana](https://example.com/report) for JS

**3 new problems** were found

| Inspection name | Severity | Problems |
| --- | --- | --- |
| \`Control flow with empty body\` | 🔴 Failure | 1 |
| \`Condition of 'if' expression is constant\` | 🔶 Warning | 1 |
| \`Might be 'const'\` | ◽️ Notice | 1 |


💡 Qodana analysis was run in the pull request mode: only the changed files were checked
☁️ [View the detailed Qodana report](https://example.com/report)
<details>
<summary>Dependencies licenses</summary>

There is no licenses information available
</details>
<details>
<summary>Contact Qodana team</summary>

Contact us at [qodana-support@jetbrains.com](mailto:qodana-support@jetbrains.com)
  - Or via our issue tracker: https://jb.gg/qodana-issue
  - Or share your feedback: https://jb.gg/qodana-discussions
</details>`
}

export function markdownEmptySummaryFixture(): string {
  return `# Qodana for JS

**It seems all right 👌**

No new problems were found according to the checks applied


<details>
<summary>View the detailed Qodana report</summary>

To be able to view the detailed Qodana report, you can either:
  1. Register at [Qodana Cloud](https://qodana.cloud/) and [configure the action](https://github.com/jetbrains/qodana-action#qodana-cloud)
  2. Use [GitHub Code Scanning with Qodana](https://github.com/jetbrains/qodana-action#github-code-scanning)
  3. Host [Qodana report at GitHub Pages](https://github.com/JetBrains/qodana-action/blob/3a8e25f5caad8d8b01c1435f1ef7b19fe8b039a0/README.md#github-pages)
  4. Inspect and use \`qodana.sarif.json\` (see [the Qodana SARIF format](https://www.jetbrains.com/help/qodana/qodana-sarif-output.html#Report+structure) for details)

To get \`*.log\` files or any other Qodana artifacts, run the action with \`upload-result\` option set to \`true\`, 
so that the action will upload the files as the job artifacts:
\`\`\`yaml
      - name: 'Qodana Scan'
        uses: JetBrains/qodana-action@v2023.2.0
        with:
          upload-result: true
\`\`\`

</details>

<details>
<summary>Contact Qodana team</summary>

Contact us at [qodana-support@jetbrains.com](mailto:qodana-support@jetbrains.com)
  - Or via our issue tracker: https://jb.gg/qodana-issue
  - Or share your feedback: https://jb.gg/qodana-discussions
</details>`
}

function passedCoverageFixture(): string {
  return `\`\`\`diff
@@ Code coverage @@
+ 70% total lines covered
124 lines analyzed, 87 lines covered
# Calculated according to the filters of your coverage tool
\`\`\``
}

function failedCoverageFixture(): string {
  return `\`\`\`diff
@@ Code coverage @@
- 0% total lines covered
100 lines analyzed, 0 lines covered
! 0 fresh lines covered
100 lines analyzed, 0 lines covered
# Calculated according to the filters of your coverage tool
\`\`\``
}
