# Qodana Scan

[![official JetBrains project](https://jb.gg/badges/official.svg)][jb:confluence-on-gh]
[![build-test](https://github.com/jetbrains/qodana-action/actions/workflows/test.yml/badge.svg)][gh:build]
[![Slack](https://img.shields.io/badge/Slack-%23qodana-blue)][jb:slack]
[![Twitter Follow](https://img.shields.io/twitter/follow/QodanaEvolves?style=flat)][jb:twitter]

**Qodana** is a code quality monitoring tool that identifies and suggests fixes for bugs, security vulnerabilities, duplications, and imperfections. Using this GitHub Action, run Qodana with your GitHub workflow to scan your Java, Kotlin, PHP, Python, JavaScript, TypeScript projects (and [other supported technologies by Qodana](https://www.jetbrains.com/help/qodana/supported-technologies.html)).

**Table of Contents**

<!-- toc -->

- [Qodana Scan](#qodana-scan)
  - [Usage](#usage)
  - [Configuration](#configuration)
  - [Issue Tracker](#issue-tracker)
  - [License](#license)

<!-- tocstop -->

## Usage

To start running Qodana in your CI pipeline on GitHub all you need is to add the following lines to your workflow file:
```yaml
- uses: JetBrains/qodana-action@v4.2.0  # you can use @main if you want to use the latest version
  with:
    linter: jetbrains/qodana-js:latest  # Docker image full name with a tag
```

If you don't have any prepared workflow file in your repository, you can create a new one by using the example (store it
at `.github/workflows/code_scanning.yml`):

```yaml
name: Code Scanning
on:
  workflow_dispatch:
  pull_request:
  push:
    branches:
      - main
      - 'releases/*'

jobs:
  qodana:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: 'Qodana Scan'
        uses: JetBrains/qodana-action@v4.2.0
        with:
          linter: jetbrains/qodana-jvm
```

With the above workflow, Qodana will run on the main branch, release branches and on the pull requests coming to your repository. You will be able to see the results of the scan in the GitHub UI.

### GitHub Pages

If you want to see [the full Qodana report](https://www.jetbrains.com/help/qodana/html-report.html) right on GitHub, you can host it on your repository [GitHub Pages](https://docs.github.com/en/pages), using the following example workflow:
```yaml
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ${{ runner.temp }}/qodana/results/report
          destination_dir: ./
```
Note: It's not possible to host multiple reports on GitHub Pages in one repository.


### GitHub code scanning

You can set up [GitHub code scanning](https://docs.github.com/en/code-security/code-scanning/automatically-scanning-your-code-for-vulnerabilities-and-errors/about-code-scanning) with Qodana for your project by adding the following lines after Qodana action to your workflow file:
```yaml
      - uses: github/codeql-action/upload-sarif@v1
        with:
          sarif_file: ${{ runner.temp }}/qodana/results/qodana.sarif.json
```

## Configuration

| Name                       | Description                                                                                                                        | Default Value                           |
|----------------------------|------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------|
| `linter`                   | [Official Qodana Docker image](https://www.jetbrains.com/help/qodana/docker-images.html). Required.                                | `jetbrains/qodana-jvm-community:latest` |
| `project-dir`              | The project's root directory to be analyzed. Optional                                                                              | `${{ github.workspace }}`               |
| `results-dir`              | Directory to store the analysis results. Optional.                                                                                 | `${{ runner.temp }}/qodana/results`     |
| `cache-dir`                | Directory to store Qodana caches. Optional.                                                                                        | `${{ runner.temp }}/qodana/caches`      |
| `idea-config-dir`          | IntelliJ IDEA configuration directory. Optional.                                                                                   | -                                       |
| `gradle-settings-path`     | Provide path to gradle.properties file. An example: "/your/custom/path/gradle.properties". Optional.                               | -                                       |
| `additional-volumes`       | Mount additional volumes to Docker container. Multiline input variable: specify multiple values with newlines. Optional.                                                                            | -                                       |
| `additional-env-variables` | Pass additional environment variables to docker container. Multiline input variable: specify multiple values with newlines. Optional.                                                               | -                                       |
| `fail-threshold`           | Set the number of problems that will serve as a quality gate. If this number is reached, the pipeline run is terminated. Optional. | -                                       |
| `inspected-dir`            | Directory to be inspected. If not specified, the whole project is inspected by default. Optional.                                  | -                                       |
| `baseline-path`            | Run in baseline mode. Provide the path to an existing SARIF report to be used in the baseline state calculation. Optional.         | -                                       |
| `baseline-include-absent`  | Include the results from the baseline absent in the current Qodana run in the output report. Optional.                             | `false`                                 |
| `changes`                  | Inspect uncommitted changes and report new problems. Optional.                                                                     | `false`                                 |
| `script`                   | Override the default docker scenario. Optional.                                                                                    | -                                       |
| `profile-name`             | Name of a profile defined in the project. Optional.                                                                                | -                                       |
| `profile-path`             | Absolute path to the profile file. Optional.                                                                                       | -                                       |
| `upload-result`            | Upload Qodana results as an artifact to the job. Optional.                                                                         | `true`                                  |
| `use-caches`               | Utilize GitHub caches for Qodana runs. Optional.                                                                                   | `true`                                  |
| `additional-cache-hash`    | Allows customizing the generated cache hash. Optional.                                                                             |                                         `${{ github.sha }}` |
| `use-annotations`          | Use annotation to mark the results in the GitHub user interface. Optional.                                                         | `true`                                  |
| `github-token`             | GitHub token to be used for uploading results. Optional.                                                                           | `${{ github.token }}`                   |

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
