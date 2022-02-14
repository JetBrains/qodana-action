[![GitHub Discussions](https://img.shields.io/github/discussions/jetbrains/qodana)][jb:discussions]
[![Twitter Follow](https://img.shields.io/twitter/follow/Qodana?style=social&logo=twitter)][jb:twitter]

**Qodana** is a code quality monitoring tool that identifies and suggests fixes for bugs, security vulnerabilities,
duplications, and imperfections.

**Table of Contents**

<!-- toc -->
- Qodana Scan
  - [Usage](#usage)
  - [Configuration](#configuration)
  - [Issue Tracker](#issue-tracker)
  - [License](#license)

<!-- tocstop -->

# Qodana Scan

Qodana Scan is an Azure Pipelines task packed inside this extension to scan your code with Qodana.

## Usage

### Basic configuration

After you've installed [Qodana for Azure Pipelines](https://marketplace.visualstudio.com/items?itemName=JetBrains.qodana) to your organization, to configure the Qodana Scan task, edit your `azure-pipelines.yml` file:

```yaml
# Start with a minimal pipeline that you can customize to build and deploy your code.
# Add steps that build, run tests, deploy, and more:
# https://aka.ms/yaml

trigger:
  - main

pool:
  vmImage: ubuntu-latest

steps:
  - task: Cache@2  # Not required, but Qodana will open projects with cache faster.
    inputs:
      key: '"$(Build.Repository.Name)" | "$(Build.SourceBranchName)" | "$(Build.SourceVersion)"'
      path: '$(Agent.TempDirectory)/qodana/cache'
      restoreKeys: |
        "$(Build.Repository.Name)" | "$(Build.SourceBranchName)"
        "$(Build.Repository.Name)"
  - task: QodanaScan@1
```

Triggering this job depends on [what type of repository you are using in Azure Pipelines](https://docs.microsoft.com/en-us/azure/devops/pipelines/build/triggers?view=azure-devops#classic-build-pipelines-and-yaml-pipelines).

The task can be run on any OS and x86_64/arm64 CPUs, but it requires the agent to have Docker installed. And since most of Qodana Docker images are Linux-based, the docker daemon must run Linux containers.

## Configuration

You probably won't need other options than `args`: all other options can be helpful if you are configuring multiple Qodana Scan jobs in one workflow.

| Name            | Description                                                                                                                  | Default Value                           |
|-----------------|------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------|
| `args`          | Additional [Qodana CLI](https://github.com/jetbrains/qodana-cli) arguments, split the arguments with commas (`,`). Optional. | -                                       |
| `resultsDir`    | Directory to store the analysis results. Optional.                                                                           | `$(Agent.TempDirectory)/qodana/results` |
| `uploadResults` | Upload Qodana results as an artifact to the job. Optional.                                                                   | `true`                                  |
| `artifactName`  | Specify Qodana results artifact name, used for results uploading. Optional.                                                  | `qodana-report`                         |
| `cacheDir`      | Directory to store Qodana caches. Optional.                                                                                  | `$(Agent.TempDirectory)/qodana/cache`   |

## Issue Tracker

All the issues, feature requests, and support related to the Qodana Azure Pipelines extension are handled on [YouTrack][youtrack].

If you'd like to file a new issue, please use the link [YouTrack | New Issue][youtrack-new-issue].


[gh:qodana]: https://github.com/JetBrains/qodana-action/actions/workflows/code_scanning.yml

[youtrack]: https://youtrack.jetbrains.com/issues/QD

[youtrack-new-issue]: https://youtrack.jetbrains.com/newIssue?project=QD&c=Platform%20Azure%20Pipelines

[jb:confluence-on-gh]: https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub

[jb:discussions]: https://jb.gg/qodana-discussions

[jb:twitter]: https://twitter.com/Qodana

[jb:docker]: https://hub.docker.com/r/jetbrains/qodana
