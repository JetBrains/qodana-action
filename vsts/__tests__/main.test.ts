import {expect, test} from '@jest/globals'
import {getSummary} from '../../common/output'
import {DEPENDENCY_CHARS_LIMIT, VIEW_REPORT_OPTIONS} from '../src/output'
import {
  outputEmptyFixture,
  problemDescriptorsDefaultFixture
} from '../../common/__tests__/common.test.utils'

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
  - Register at [Qodana Cloud](https://qodana.cloud/) and [configure the task](https://www.jetbrains.com/help/qodana/qodana-azure-pipelines.html#Qodana+Cloud)
  - Use [SARIF SAST Scans Tab](https://marketplace.visualstudio.com/items?itemName=sariftools.scans) extension to display report summary in Azure DevOps UI in 'Scans' tab
  - Inspect and use \`qodana.sarif.json\` (see [the Qodana SARIF format](https://www.jetbrains.com/help/qodana/qodana-sarif-output.html#Report+structure) for details)

To get \`*.log\` files or any other Qodana artifacts, run the task with \`uploadResult\` option set to \`true\`, 
so that the action will upload the files as the job artifacts:
\`\`\`yaml
        - task: QodanaScan@2025.1.1
          inputs:
            uploadResult: true
\`\`\`

</details>

<details>
<summary>Contact Qodana team</summary>

Contact us at [qodana-support@jetbrains.com](mailto:qodana-support@jetbrains.com)
  - Or via our issue tracker: https://jb.gg/qodana-issue
  - Or share your feedback: https://jb.gg/qodana-discussions
</details>`
}
