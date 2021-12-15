# Qodana Linters

**Qodana** is a code quality monitoring tool that identifies and suggests fixes for bugs, security vulnerabilities, duplications, and imperfections.
Qodana already supports PHP, Java, and Kotlin projects, and will eventually support all languages and technologies covered by JetBrains IDEs.

**Table of Contents**

<!-- toc -->

- [Qodana Linters](#qodana-linters)
    - [Usage](#usage)
    - [Configuration](#configuration)
    - [License](#license)

<!-- tocstop -->


## Usage

```yaml
- uses: JetBrains/qodana-action@v3.2.1
  with:  # optional
    linter: jetbrains/qodana-jvm-community:2021.2  # Docker image full name
    fail-threshold: 10  # to set a quality gate to the number of found problems
    additional-env-variables: |
        IDEA_PROPERTIES='/data/project/idea.properties'
```

Before you begin, view the list of [Supported Technologies](https://www.jetbrains.com/help/qodana/supported-technologies.html). For the full documentation of the action's inputs, see [action.yaml](action.yaml).

## Configuration

- `linter`: Qodana linter. All possible values can be found here: https://hub.docker.com/r/jetbrains/qodana. Required. Defaults to `jetbrains/qodana-jvm-community`
- `project-dir`: Root directory of the project to be analyzed. Optional. Defaults to `${{ github.workspace }}`
- `results-dir`: Directory to store the analysis results. Optional. Defaults to `${{ github.workspace }}/qodana`
- `cache-dir`: Directory to store Qodana caches. Optional. Defaults to `${{ runner.temp }}/qodana`
- `idea-config-dir`: IntelliJ IDEA configuration directory. Optional.
- `gradle-settings-path`: Provide path to gradle.properties file. An example: "/your/custom/path/gradle.properties". Optional.
- `additional-volumes`: Mount additional volumes to Docker container. Optional.
- `additional-env-variables`: Pass additional environment variables to docker container. Optional.
- `inspected-dir`: Directory to be inspected. If not specified, the whole project is inspected by default. Optional.
- `baseline-path`: Run in baseline mode. Provide the path to an exisitng SARIF report to be used in the baseline state calculation. Optional.
- `baseline-include-absent`: Include in the output report the results from the baseline docker that are absent in the current docker. Optional. Defaults to `false`
- `changes`: Inspect uncommitted changes and report new problems. Optional. Defaults to `false`
- `script`: Override the default docker scenario. Optional.
- `fail-threshold`: Set the number of problems that will serve as a quality gate. If this number is reached, the inspection docker is terminated. Optional.
- `profile-name`: Name of a profile defined in project. Optional.
- `profile-path`: Absolute path to the profile file. Optional.
- `upload-result`: Upload Qodana results as an artifact to the job. Optional. Defaults to `true`
- `use-caches`: Utilize GitHub caches for Qodana runs. Optional. Defaults to `true`
- `use-annotations`: Use annotation to mark the results in GitHub user interface. Optional. Defaults to `true`
- `github-token`: GitHub token to be used for uploading results. Optional. Defaults to `${{ github.token }}`

## License

### The GitHub Action repository

This repository contains source code for Qodana GitHub Action and is licensed under [Apache-2.0](./LICENSE).

### Qodana Docker images

View [license information](https://www.jetbrains.com/legal/?fromFooter#licensing) for the Qodana Community images.

Qodana Docker images may contain other software which is subject to other licenses, for example, Bash relating to the base distribution or with any direct or indirect dependencies of the primary software).

As for any pre-built image usage, it is the image user's responsibility to ensure that any use of this image complies with any relevant licenses for all software contained within.

Using Qodana EAP Docker image you agree to [JetBrains EAP user agreement](https://www.jetbrains.com/legal/docs/toolbox/user_eap/) and [JetBrains privacy policy](https://www.jetbrains.com/legal/docs/privacy/privacy/). The docker image includes an evaluation license which will expire in 30-day. Please ensure you pull a new image on time.