import {expect, test} from '@jest/globals'
import {
  DEPENDENCY_CHARS_LIMIT,
  VIEW_REPORT_OPTIONS,
  getQodanaHelpString
} from '../src/output'
import {getSummary, parseSarif, ProblemDescriptor} from '../../common/output'

test('test typical summary output', () => {
  const result = getSummary(
    'Qodana for JS',
    'frontend',
    'web',
    problemDescriptorsDefaultFixture().reverse(), // reversed for testing the correct sorting in output
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
    outputEmptyFixture(),
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

test('test sarif with problems to output annotations', () => {
  const output = problemDescriptorsDefaultFixture()
  const result = parseSarif(
    '__tests__/data/some.sarif.json',
    getQodanaHelpString()
  )
  expect(result.problemDescriptions).toEqual(output)
})

test('test sarif with problems and baseline to output annotations', () => {
  const output = problemDescriptorsDefaultFixture()
  const result = parseSarif(
    '__tests__/data/with.baseline.sarif.json',
    getQodanaHelpString()
  )
  expect(result.problemDescriptions).toEqual(output)
})

test('test sarif with no problems to output annotations', () => {
  const output = outputEmptyFixture()
  const result = parseSarif(
    '__tests__/data/empty.sarif.json',
    getQodanaHelpString()
  )
  expect(result.problemDescriptions).toEqual(output)
})

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
  - Register at [Qodana Cloud](https://qodana.cloud/) and [configure the pipeline](https://www.jetbrains.com/help/qodana/gitlab.html#Expose+Qodana+reports)
  - Inspect and use \`qodana.sarif.json\` (see [the Qodana SARIF format](https://www.jetbrains.com/help/qodana/qodana-sarif-output.html#Report+structure) for details)

To get \`*.log\` files or any other Qodana artifacts, run the task with \`upload-result\` option set to \`true\`, 
so that the job will upload the files as the job artifacts:

\`\`\`yaml
        include:
          - component: $CI_SERVER_FQDN/qodana/qodana/qodana-gitlab-ci@2024.3.5
            inputs:
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

export function problemDescriptorsDefaultFixture(): ProblemDescriptor[] {
  return [
    {
      level: 'failure',
      title: 'Control flow with empty body'
    },
    {
      level: 'warning',
      title: "Condition of 'if' expression is constant"
    },
    {
      level: 'warning',
      title: 'Rider toolset and environment errors'
    },
    {
      level: 'notice',
      title: "Might be 'const'"
    }
  ]
}

export function outputEmptyFixture(): ProblemDescriptor[] {
  return []
}
