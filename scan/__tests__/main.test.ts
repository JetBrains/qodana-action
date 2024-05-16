import {expect, test} from '@jest/globals'
import {AnnotationProperties} from '@actions/core'
import {
  getCoverageFromSarif,
  getQodanaScanArgs,
  Inputs,
  QODANA_OPEN_IN_IDE_NAME,
  QODANA_REPORT_URL_NAME,
  validateBranchName
} from '../../common/qodana'
import {
  Annotation,
  getGitHubCheckConclusion,
  parseSarif,
  toAnnotationProperties
} from '../src/annotations'
import {getSummary, getCoverageStats, getReportURL} from '../src/output'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

test('validate branch names', () => {
  let validBranchNames = [
    'main',
    'dependabot/go_modules/cmd/dependencies.1987366a71',
    'refs/heads/main',
    'refs/tags/v1.0.0',
    'refs/pull/123/merge',
    'v2024.1.5'
  ]
  for (let branchName of validBranchNames) {
    expect(validateBranchName(branchName)).toEqual(branchName)
  }
})

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
    0,
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
    0,
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

describe('getReportURL', () => {
  let tempDir: string

  beforeEach(async () => {
    // create a unique temporary directory for each test
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jest-'))
  })

  afterEach(async () => {
    // cleanup - remove temporary directory
    await fs.promises.rm(tempDir, {recursive: true})
  })

  it('returns cloud URL if open in IDE file exists', async () => {
    const url = 'http://cloud.url'
    const data = {cloud: {url}}
    const filepath = path.join(tempDir, QODANA_OPEN_IN_IDE_NAME)
    await fs.promises.writeFile(filepath, JSON.stringify(data))
    console.log(JSON.stringify(data))

    const result = getReportURL(tempDir)

    expect(result).toBe(url)
  })

  it('returns report URL if open in IDE file does not exist but report file exists', async () => {
    const url = 'http://report.url'
    const filepath = path.join(tempDir, QODANA_REPORT_URL_NAME)
    await fs.promises.writeFile(filepath, url)

    const result = getReportURL(tempDir)

    expect(result).toBe(url)
  })

  it('returns empty string if no file exists', () => {
    const result = getReportURL(tempDir)

    expect(result).toBe('')
  })

  it('returns empty string if open in IDE file exists but does not contain url', async () => {
    const data = {cloud: {}}
    const filepath = path.join(tempDir, QODANA_OPEN_IN_IDE_NAME)
    await fs.promises.writeFile(filepath, JSON.stringify(data))

    const result = getReportURL(tempDir)

    expect(result).toBe('')
  })
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
      annotation_level: 'warning',
      message:
        '\\[[NU1101](http://www.google.com/search?q=NU1101)\\] Unable to find package PrivatePackage. No packages exist with this id in source(s): github at (0:0)  \n\nTarget: ResolvePackageAssets  \nTask: ResolvePackageAssets',
      end_line: 1,
      start_line: 0,
      path: 'LibraryReferencingPackage/LibraryReferencingPackage.csproj',
      title: 'Rider toolset and environment errors',
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
    commitMessage: '',
    useNightly: false
  }
}

export function defaultDockerRunCommandFixture(): string[] {
  return [
    'scan',
    '--cache-dir',
    '${{ runner.temp }}/qodana-caches',
    '--results-dir',
    '${{ runner.temp }}/qodana-results',
    '--skip-pull',
    '--baseline',
    'qodana.sarif.json'
  ]
}

export function markdownSummaryFixture(): string {
  return `# [Qodana](https://example.com/report) for JS

**4 new problems** were found

| Inspection name | Severity | Problems |
| --- | --- | --- |
| \`Control flow with empty body\` | 🔴 Failure | 1 |
| \`Rider toolset and environment errors\` | 🔶 Warning | 1 |
| \`Condition of 'if' expression is constant\` | 🔶 Warning | 1 |
| \`Might be 'const'\` | ◽️ Notice | 1 |


💡 Qodana analysis was run in the pull request mode: only the changed files were checked
☁️ [View the detailed Qodana report](https://example.com/report)
<details>
<summary>Detected 0 dependencies</summary>

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
  - Register at [Qodana Cloud](https://qodana.cloud/) and [configure the action](https://github.com/jetbrains/qodana-action#qodana-cloud)
  - Use [GitHub Code Scanning with Qodana](https://github.com/jetbrains/qodana-action#github-code-scanning)
  - Host [Qodana report at GitHub Pages](https://github.com/JetBrains/qodana-action/blob/3a8e25f5caad8d8b01c1435f1ef7b19fe8b039a0/README.md#github-pages)
  - Inspect and use \`qodana.sarif.json\` (see [the Qodana SARIF format](https://www.jetbrains.com/help/qodana/qodana-sarif-output.html#Report+structure) for details)

To get \`*.log\` files or any other Qodana artifacts, run the action with \`upload-result\` option set to \`true\`, 
so that the action will upload the files as the job artifacts:
\`\`\`yaml
      - name: 'Qodana Scan'
        uses: JetBrains/qodana-action@v2024.1.5
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
! 0% fresh lines covered
100 lines analyzed, 0 lines covered
# Calculated according to the filters of your coverage tool
\`\`\``
}
