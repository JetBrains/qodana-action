## Qodana Code Inspection Action for Github Actions

![Qodana EAP version alert](resources/eap-alert.png)

**Qodana** is a code quality monitoring tool that identifies and suggests fixes for bugs, security vulnerabilities, duplications, and imperfections.
Qodana already supports PHP, Java, and Kotlin projects, and will eventually support all languages and technologies covered by JetBrains IDEs.

**Table of Contents**

<!-- toc -->

- [Usage](#usage)
- [Output Results](#output-results)
- [License Summary](#license-summary)

<!-- tocstop -->


## Usage

Input parameters:
* `project-dir` - Project folder to inspect (default `${{ github.workspace }}`)
* `results-dir` - Save results to folder (default `${{ github.workspace }}/qodana`)
* `cache-dir` - Save cache to folder (default `/home/runner/work/_temp/_github_home/qodana-cache`)

```yaml
- name: Qodana - Code Inspection
  uses: JetBrains/qodana-action@v2.0-eap
```

All action's inputs are optional. 
```yaml
- name: Qodana - Code Inspection
  uses: JetBrains/qodana-action@v2.0-eap
  with:
      project-dir: ${{ github.workspace }}
      results-dir: ${{ github.workspace }}/qodana
      cache-dir: /home/runner/work/_temp/_github_home/qodana-cache
```

Before you begin, view the list of [Supported Technologies](https://github.com/JetBrains/Qodana/blob/main/General/supported-technologies.md). For the full documentation of the action's inputs, see [action.yaml](action.yaml).

## Output Results

An example of the Qodana command-line summary output:
```
---- Qodana - Code Inspection ----

2 problem(s) with Critical severity
 - Category(ies): General

1 problem(s) with Moderate severity
 - Category(ies): Code style

---- Problems reported: 3 ----
```

Full Qodana results are available in the file `results-allProblems.json` located in the `results-dir` folder.

## License Summary

By using Qodana, you agree to the [JetBrains EAP user agreement](https://www.jetbrains.com/legal/agreements/user_eap.html) and [JetBrains privacy policy](https://www.jetbrains.com/company/privacy.html).
