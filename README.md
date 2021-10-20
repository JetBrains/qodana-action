# Qodana Linters

**Qodana** is a code quality monitoring tool that identifies and suggests fixes for bugs, security vulnerabilities, duplications, and imperfections.
Qodana already supports PHP, Java, and Kotlin projects, and will eventually support all languages and technologies covered by JetBrains IDEs.

**Table of Contents**

<!-- toc -->

- [Qodana Linters](#qodana-linters)
  - [Usage](#usage)
  - [License](#license)

<!-- tocstop -->


## Usage

Input parameters:
* `linter` - Qodana Linter. Possible values: `qodana-jvm-community`
* `project-dir` - Project folder to inspect (default `${{ github.workspace }}`)
* `results-dir` - Save results to folder (default `${{ github.workspace }}/qodana`)
* `cache-dir` - Save cache to folder (default `/home/runner/work/_temp/_github_home/qodana-cache`)
* `inspected-dir` - Directory to be inspected. If not specified, the whole project is inspected by default
* `baseline` - Run in baseline mode. Provide the path to an exisitng SARIF report to be used in the baseline state calculation
* `baseline-include-absent` - Include in the output report the results from the baseline run that are absent in the current run (default `false`)
* `fail-threshold` - Set the number of problems that will serve as a quality gate. If this number is reached, the inspection run is terminated
* `save-html-report` - Generate HTML report (default `false`)
* `profile-name` - Name of a profile defined in project
* `profile-path` - Absolute path to the profile file
* `gradle-settings-path` - Provide path to gradle.properties file (for example: `/your/custom/path/gradle.properties`)
* `additional-volumes` - Additional volumes to mount to qodana docker image
* `additional-env-variables` - Additional environment variables to pass to qodana docker image

```yaml
- uses: JetBrains/qodana-action@v3.1.1
  with:
    linter: qodana-jvm-community
    fail-threshold: 10
    additional-env-variables: |
        IDEA_PROPERTIES='/data/project/idea.properties'
```

Before you begin, view the list of [Supported Technologies](https://www.jetbrains.com/help/qodana/supported-technologies.html). For the full documentation of the action's inputs, see [action.yaml](action.yaml).

## License

View [license information](https://www.jetbrains.com/legal/?fromFooter#licensing) for the Qodana for JVM Community linter software contained in this image.

This Docker image may contain other software which is subject to other licenses, for example, Bash relating to the base distribution or with any direct or indirect dependencies of the primary software).

As for any pre-built image usage, it is the image user's responsibility to ensure that any use of this image complies with any relevant licenses for all software contained within.
