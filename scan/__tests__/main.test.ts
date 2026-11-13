/*
 * Copyright 2021-2026 JetBrains s.r.o.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {expect, test} from '@jest/globals'
import * as core from '@actions/core'
import {AnnotationProperties} from '@actions/core'
import * as exec from '@actions/exec'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  getQodanaScanArgs,
  Inputs,
  validateBranchName
} from '../../common/qodana'
import {
  Annotation,
  getGitHubCheckConclusion,
  parseSarif,
  toAnnotationProperties
} from '../src/annotations'
import {getSummary} from '../../common/output'
import {
  annotationsToProblemDescriptors,
  VIEW_REPORT_OPTIONS,
  DEPENDENCY_CHARS_LIMIT
} from '../src/output'
import {
  addEdictParams,
  EDICT_FEEDBACK_UNAVAILABLE,
  postEdictFeedback,
  prepareEdictFeedback
} from '../src/edictFeedback'

test('test typical summary output', () => {
  const result = getSummary(
    'Qodana for JS',
    'frontend',
    'web',
    annotationsToProblemDescriptors(annotationsDefaultFixture()).reverse(), // reversed for testing the correct sorting in output
    '',
    0,
    'There is no licenses information available',
    'https://example.com/report',
    true,
    DEPENDENCY_CHARS_LIMIT,
    VIEW_REPORT_OPTIONS
  )
  expect(result).toEqual(markdownSummaryFixture())
})

test('test empty summary output', () => {
  const result = getSummary(
    'Qodana for JS',
    '',
    '',
    annotationsToProblemDescriptors(outputEmptyFixture()),
    '',
    0,
    '',
    '',
    false,
    DEPENDENCY_CHARS_LIMIT,
    VIEW_REPORT_OPTIONS
  )
  expect(result).toEqual(markdownEmptySummaryFixture())
})

test('validate branch names', () => {
  let validBranchNames = [
    'main',
    'dependabot/go_modules/cmd/dependencies.1987366a71',
    'refs/heads/main',
    'refs/tags/v1.0.0',
    'refs/pull/123/merge',
    'v2026.2.2'
  ]
  for (let branchName of validBranchNames) {
    expect(validateBranchName(branchName)).toEqual(branchName)
  }
})

test('reject branch names that git could parse as options', () => {
  let invalidBranchNames = [
    '--upload-pack=touch',
    '-b',
    'main..feature',
    'main feature',
    'main;rm'
  ]
  for (let branchName of invalidBranchNames) {
    expect(() => validateBranchName(branchName)).toThrow('Invalid branch name')
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

test('qodana scan command args with inherited environment variables', () => {
  const inputs = inputsDefaultFixture()
  const result = getQodanaScanArgs(
    inputs.args,
    inputs.resultsDir,
    inputs.cacheDir,
    ['SPACE_USER', 'SPACE_KEY', 'UNSET_VARIABLE'],
    {SPACE_USER: 'user', SPACE_KEY: 'secret'}
  )
  expect(result).toEqual([
    'scan',
    '--cache-dir',
    '${{ runner.temp }}/qodana-caches',
    '--results-dir',
    '${{ runner.temp }}/qodana-results',
    '--skip-pull',
    '-e',
    'SPACE_USER=user',
    '-e',
    'SPACE_KEY=secret',
    '--baseline',
    'qodana.sarif.json'
  ])
})

test('qodana scan command args ignore environment variables in native mode', () => {
  const inputs = inputsDefaultFixture()
  const result = getQodanaScanArgs(
    ['--ide'],
    inputs.resultsDir,
    inputs.cacheDir,
    ['SPACE_KEY'],
    {SPACE_KEY: 'secret'}
  )
  expect(result).toEqual([
    'scan',
    '--cache-dir',
    '${{ runner.temp }}/qodana-caches',
    '--results-dir',
    '${{ runner.temp }}/qodana-results',
    '--ide'
  ])
})

describe('Edict feedback', () => {
  /** Inputs of a project in a subdirectory with its own configuration file, with Edict feedback on. */
  function edictInputs(
    args = ['-i', 'backend', '--config', 'qodana.edict.yaml']
  ): Inputs {
    return {...inputsDefaultFixture(), args, enableEdictFeedback: true}
  }

  let warning: jest.SpyInstance

  beforeEach(() => {
    warning = jest.spyOn(core, 'warning').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  /** Answers every CLI run with [exitCode]. */
  function cli(exitCode: number): jest.SpyInstance {
    return jest
      .spyOn(exec, 'getExecOutput')
      .mockResolvedValue({exitCode, stdout: '', stderr: ''})
  }

  test('scan names the inspections on the host, whether it runs in a container or natively', () => {
    // The CLI mounts the directory into a container; only it knows the run is native when qodana.yaml says so.
    const runs = [edictInputs(), edictInputs(['--ide', '/opt/idea'])].map(
      inputs => {
        const scanArgs = ['scan']
        addEdictParams(scanArgs, inputs)
        return scanArgs
      }
    )
    const hostDirectory = [
      'scan',
      '--property',
      'qodana.internal.inspections.kts.dir=/runner/temp/edict-feedback'
    ]
    expect(runs).toEqual([hostDirectory, hostDirectory])
  })

  test('scan runs no Edict inspections when feedback is off', () => {
    const scanArgs = ['scan']
    addEdictParams(scanArgs, inputsDefaultFixture())
    expect(scanArgs).toEqual(['scan'])
  })

  test('prepare creates the inspections directory for the mount and runs in the project directory with its configuration', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'edict-feedback-test-')
    )
    const inputs = {
      ...edictInputs(),
      edictInspectionsDir: path.join(tempDir, 'edict-feedback')
    }
    const run = cli(0)

    try {
      await prepareEdictFeedback(inputs)

      expect(fs.existsSync(inputs.edictInspectionsDir)).toBe(true)
    } finally {
      fs.rmSync(tempDir, {recursive: true, force: true})
    }
    expect(run).toHaveBeenCalledWith(
      'qodana',
      [
        'edict',
        'feedback',
        'prepare',
        '--state-dir',
        '/runner/temp/edict-state',
        '--output-dir',
        inputs.edictInspectionsDir,
        '--config',
        'qodana.edict.yaml'
      ],
      {ignoreReturnCode: true, cwd: 'backend', env: undefined}
    )
    expect(warning).not.toHaveBeenCalled()
  })

  test('a command the CLI cannot run is a warning, not a failure of the action', async () => {
    jest
      .spyOn(exec, 'getExecOutput')
      .mockRejectedValue(new Error('Unable to locate executable file: qodana'))

    await postEdictFeedback(edictInputs(), true)

    expect(warning).toHaveBeenCalledWith(
      `${EDICT_FEEDBACK_UNAVAILABLE}: qodana edict feedback post failed – Unable to locate executable file: qodana`
    )
  })

  test('post comments with the findings of the scan report and the token', async () => {
    const run = cli(0)

    await postEdictFeedback(
      {
        ...edictInputs(),
        githubToken: 'token',
        resultsDir: '/runner/temp/qodana-results'
      },
      true
    )

    expect(run).toHaveBeenCalledWith(
      'qodana',
      [
        'edict',
        'feedback',
        'post',
        '--state-dir',
        '/runner/temp/edict-state',
        '--sarif',
        '/runner/temp/qodana-results/qodana.sarif.json',
        '--config',
        'qodana.edict.yaml'
      ],
      expect.objectContaining({
        cwd: 'backend',
        env: expect.objectContaining({GITHUB_TOKEN: 'token'})
      })
    )
    expect(warning).not.toHaveBeenCalled()
  })

  test('post comments nothing when the results could not be published to the pull request', async () => {
    const run = cli(0)

    await postEdictFeedback(edictInputs(), false)

    expect(run).not.toHaveBeenCalled()
    expect(warning).toHaveBeenCalledWith(
      `${EDICT_FEEDBACK_UNAVAILABLE}: Qodana could not publish its results to the pull request`
    )
  })

  test('a failed post is a warning', async () => {
    cli(1)

    await postEdictFeedback(edictInputs(), true)

    expect(warning).toHaveBeenCalledWith(
      `${EDICT_FEEDBACK_UNAVAILABLE}: qodana edict feedback post failed with exit code 1`
    )
  })
})

test('test sarif with problems to output annotations', () => {
  const output = annotationsDefaultFixture()
  const result = parseSarif('__tests__/data/some.sarif.json')
  expect(result.annotations).toEqual(output)
})

test('test sarif with problems and baseline to output annotations', () => {
  const output = annotationsDefaultFixture()
  const result = parseSarif('__tests__/data/with.baseline.sarif.json')
  expect(result.annotations).toEqual(output)
})

test('test sarif with no problems to output annotations', () => {
  const output = outputEmptyFixture()
  const result = parseSarif('__tests__/data/empty.sarif.json')
  expect(result.annotations).toEqual(output)
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
    envVarsToLinter: [],
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
    nightlyVersion: '',
    useInstalledCli: false,
    enableEdictFeedback: false,
    edictStateDir: '/runner/temp/edict-state',
    edictInspectionsDir: '/runner/temp/edict-feedback',
    workingDirectory: '',
    sarifArtifactLocation: ''
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
Analyzed project: \`frontend/\`
Analyzed directory: \`web/\`

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
        uses: JetBrains/qodana-action@v2026.2.2
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
