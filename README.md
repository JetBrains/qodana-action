# Qodana Linters

[![official JetBrains project](https://jb.gg/badges/official.svg)][jb:confluence-on-gh]
[![build-test](https://github.com/jetbrains/qodana-action/actions/workflows/test.yml/badge.svg)][gh:build]
[![Slack](https://img.shields.io/badge/Slack-%23qodana-blue)][jb:slack]
[![Twitter Follow](https://img.shields.io/twitter/follow/QodanaEvolves?style=flat)][jb:twitter]

**Qodana** is a code quality monitoring tool that identifies and suggests fixes for bugs, security vulnerabilities, duplications, and imperfections. This action allows running Qodana with your GitHub workflow.

**Table of Contents**

<!-- toc -->

- [Qodana Linters](#qodana-linters)
  - [Usage](#usage)
  - [Configuration](#configuration)
  - [Issue Tracker](#issue-tracker)
  - [License](#license)

<!-- tocstop -->

## Usage

```yaml
- uses: JetBrains/qodana-action@v4.0.0  # you can use @main if you want to use the latest version
  with:  # optional
    linter: jetbrains/qodana-jvm-community:latest  # Docker image full name with a tag
    fail-threshold: 10  # to set a quality gate to the number of found problems
    additional-env-variables: |
      IDEA_PROPERTIES='/data/project/idea.properties'
```

Before you begin, view the [Supported Technologies](https://www.jetbrains.com/help/qodana/supported-technologies.html).

## Configuration

- `linter`: Qodana linter – official Qodana Docker image. Required. Defaults to `jetbrains/qodana-jvm-community:latest`. This action supports running all [IntelliJ-based Qodana images](https://www.jetbrains.com/help/qodana/docker-images.html).
  Use the following images depending on what technologies are used in your project:
  - `jetbrains/qodana-jvm-community` – for Java/Kotlin projects
  - `jetbrains/qodana-jvm` – same as Qodana Community for JVM, but with advanced inspections from IntelliJ IDEA Ultimate
  - `jetbrains/qodana-jvm-android` – for Android projects
  - `jetbrains/qodana-js` – for JavaScript/TypeScript projects
  - `jetbrains/qodana-python` – for Python projects

- `project-dir`: The project's root directory to be analyzed. Optional. Defaults to `${{ github.workspace }}`
- `results-dir`: Directory to store the analysis results. Optional. Defaults to `${{ github.workspace }}/qodana`
- `cache-dir`: Directory to store Qodana caches. Optional. Defaults to `${{ runner.temp }}/qodana`
- `idea-config-dir`: IntelliJ IDEA configuration directory. Optional.
- `gradle-settings-path`: Provide path to gradle.properties file. An example: "/your/custom/path/gradle.properties". Optional.
- `additional-volumes`: Mount additional volumes to Docker container. Optional.
- `additional-env-variables`: Pass additional environment variables to docker container. Optional.
- `inspected-dir`: Directory to be inspected. If not specified, the whole project is inspected by default. Optional.
- `baseline-path`: Run in baseline mode. Provide the path to an existing SARIF report to be used in the baseline state calculation. Optional.
- `baseline-include-absent`: Include the results from the baseline absent in the current Qodana run in the output report. Optional. Defaults to `false`
- `changes`: Inspect uncommitted changes and report new problems. Optional. Defaults to `false`
- `script`: Override the default docker scenario. Optional.
- `fail-threshold`: Set the number of problems that will serve as a quality gate. If this number is reached, the pipeline run is terminated. Optional.
- `profile-name`: Name of a profile defined in the project. Optional.
- `profile-path`: Absolute path to the profile file. Optional.
- `upload-result`: Upload Qodana results as an artifact to the job. Optional. Defaults to `true`
- `use-caches`: Utilize GitHub caches for Qodana runs. Optional. Defaults to `true`
- `use-annotations`: Use annotation to mark the results in the GitHub user interface. Optional. Defaults to `true`
- `github-token`: GitHub token to be used for uploading results. Optional. Defaults to `${{ github.token }}`

## Issue Tracker

All the issues, feature requests, and support related to the Qodana GitHub Action are handled on [YouTrack][youtrack].

If you'd like to file a new issue, please use the link [YouTrack | New Issue][youtrack-new-issue].

## License

### The GitHub Action repository

This repository contains source code for Qodana GitHub Action and is licensed under [Apache-2.0](./LICENSE).

### Qodana Docker images

#### Qodana Community images

View [license information](https://www.jetbrains.com/legal/?fromFooter#licensing) for the Qodana Community images.

Qodana Docker images may contain other software which is subject to other licenses, for example, Bash relating to the base distribution or with any direct or indirect dependencies of the primary software).

As for any pre-built image usage, it is the image user's responsibility to ensure that any use of this image complies with any relevant licenses for all software contained within.

#### Qodana EAP images

Using the Qodana EAP Docker images, you agree to [JetBrains EAP user agreement](https://www.jetbrains.com/legal/docs/toolbox/user_eap/) and [JetBrains privacy policy](https://www.jetbrains.com/legal/docs/privacy/privacy/). The docker image includes an evaluation license which will expire in 30-day. Please ensure you pull a new image on time.

[gh:build]: https://github.com/jetbrains/qodana-action/actions/workflows/test.yml
[youtrack]: https://youtrack.jetbrains.com/issues/QD
[youtrack-new-issue]: https://youtrack.jetbrains.com/newIssue?project=QD&c=Platform%20GitHub%20Action
[jb:confluence-on-gh]: https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub
[jb:slack]: https://jb.gg/qodana-slack
[jb:twitter]: https://twitter.com/QodanaEvolves
