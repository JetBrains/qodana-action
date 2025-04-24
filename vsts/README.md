[![GitHub Discussions](https://img.shields.io/github/discussions/jetbrains/qodana)][jb:discussions]
[![Twitter Follow](https://img.shields.io/badge/follow-%40Qodana-1DA1F2?logo=twitter&style=social)][jb:twitter]

**Qodana** is a code quality monitoring tool that identifies and suggests fixes for bugs, security vulnerabilities,
duplications, and imperfections.

**Table of Contents**

<!-- toc -->

- Qodana Scan
    - [Usage](#usage)
    - [Configuration](#configuration)
    - [Issue Tracker](#issue-tracker)

<!-- tocstop -->
[//]: # (title: Azure Pipelines)

# Qodana Scan

Qodana Scan is an Azure Pipelines task
packed inside the [Qodana Azure Pipelines extension](https://marketplace.visualstudio.com/items?itemName=JetBrains.qodana)
to scan your code with Qodana.

## Usage

### Basic configuration

After you've installed [Qodana Azure Pipelines extension](https://marketplace.visualstudio.com/items?itemName=JetBrains.qodana) to your organization, to configure the Qodana Scan task, edit your `azure-pipelines.yml` file:

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
  - task: QodanaScan@2025
```

Triggering this job depends on [what type of repository you are using in Azure Pipelines](https://docs.microsoft.com/en-us/azure/devops/pipelines/build/triggers?view=azure-devops#classic-build-pipelines-and-yaml-pipelines).

The task can be run on any OS and x86_64/arm64 CPUs, but it requires the agent to have Docker installed.
And since most of the Qodana Docker images are Linux-based, the docker daemon must be able to run Linux containers.

### Apply quick-fixes

To make Qodana automatically fix found issues and push the changes to your repository,
you need
to
1. Choose what kind of fixes to apply
    - [Specify `fixesStrategy` in the `qodana.yaml` file in your repository root](https://www.jetbrains.com/help/qodana/qodana-yaml.html)
    - Or set the task `args` property with the quick-fix strategy to use: `--apply-fixes` or `--cleanup`
2. Set `pushFixes` property to
    - `pull-request`: create a new branch with fixes and create a pull request to the original branch
    - or `branch`: push fixes to the original branch
3. Set the correct permissions for the job. Go to `Repositories` → `Manage repositories` → `Security`. Choose `Qodana for Azure Pipelines Build Service` user. Allow:
    - `Contribute`
    - `Bypass policies when pushing` if they may fail the push of quick-fixes
    - `Create branch` if you use `pull-request` value
   
   Also, set `persistCredentials` property to `true`. This is needed for pushing changes to the repository

Example configuration:

```yaml
steps:
  - checkout: self
    fetchDepth: 0
    persistCredentials: true
  - task: QodanaScan@2025
    env:
      QODANA_TOKEN: $(QODANA_TOKEN)
    inputs:
      pushFixes: "branch"
      args: "--apply-fixes"
```

> **Note**
> Qodana could automatically modify not only the code, but also the configuration in `.idea`: if you do not wish to push these changes, add `.idea` to your `.gitignore` file.

### Qodana Cloud

To send the results to Qodana Cloud, all you need to do is to specify the `QODANA_TOKEN` environment variable in the build configuration.

1. In the Azure Pipelines UI, create the `QODANA_TOKEN` [secret variable](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/set-secret-variables?view=azure-devops&tabs=yaml%2Cbash#secret-variable-in-the-ui) and
   save the [project token](https://www.jetbrains.com/help/qodana/cloud-projects.html#cloud-manage-projects) as its value.
2. In the Azure pipeline file,
   add `QODANA_TOKEN` variable to the `env` section of the `QodanaScan` task:

```yaml
  - task: QodanaScan@2025
    env:
      QODANA_TOKEN: $(QODANA_TOKEN)
```

After the token is set for analysis, all Qodana Scan job results will be uploaded to your Qodana Cloud project.

![Qodana Cloud](https://user-images.githubusercontent.com/13538286/214899046-572649db-fe62-49b2-a368-b5d07737c1c1.gif)

### SARIF SAST Scans Tab

To display Qodana report summary in Azure DevOps UI in 'Scans' tab, install Microsoft DevLabs’ [SARIF SAST Scans Tab](https://marketplace.visualstudio.com/items?itemName=sariftools.scans) extension.

![Azure Scans Tab](https://user-images.githubusercontent.com/13538286/160094802-df9b86b6-be53-45c1-a70c-8edfcde9412a.png)

## Configuration

You probably won't need other options than `args`: all other options can be helpful if you are configuring multiple Qodana Scan jobs in one workflow.

| Name            | Description                                                                                                                                                                                                                                                                                                                            | Default Value                           |
|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------|
| `args`          | Additional [Qodana CLI `scan` command](https://github.com/jetbrains/qodana-cli#scan) arguments, split the arguments with commas (`,`), for example `-i,frontend`. Optional.                                                                                                                                                            |                                         |
| `resultsDir`    | Directory to store the analysis results. Optional.                                                                                                                                                                                                                                                                                     | `$(Agent.TempDirectory)/qodana/results` |
| `uploadResult`  | Upload Qodana results as an artifact to the job. Optional.                                                                                                                                                                                                                                                                             | `false`                                 |
| `uploadSarif`   | For SARIF SAST Scans Tab extension. Upload qodana.sarif.json as an qodana.sarif artifact to the job. Optional.                                                                                                                                                                                                                         | `true`                                  |
| `artifactName`  | Specify Qodana results artifact name, used for results uploading. Optional.                                                                                                                                                                                                                                                            | `qodana-report`                         |
| `cacheDir`      | Directory to store Qodana caches. Optional.                                                                                                                                                                                                                                                                                            | `$(Agent.TempDirectory)/qodana/cache`   |
| `prMode`        | Analyze ONLY changed files in a pull request. Optional.                                                                                                                                                                                                                                                                                | `true`                                  |
| `postPrComment` | Post a comment with the Qodana results summary to the pull request. Needs `Contribute to pull request` permission and [SYSTEM_ACCESSTOKEN](https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml#systemaccesstoken) or `persistCredentials` set to true during checkout step. Optional. | `false`                                 |
| `pushFixes`     | Push Qodana fixes to the repository, can be `none`, `branch` to the current branch, or `pull-request`. Optional.                                                                                                                                                                                                                       | `none`                                  |

[gh:qodana]: https://github.com/JetBrains/qodana-action/actions/workflows/code_scanning.yml
[youtrack]: https://youtrack.jetbrains.com/issues/QD
[youtrack-new-issue]: https://youtrack.jetbrains.com/newIssue?project=QD&c=Product%20Azure%20extension
[jb:confluence-on-gh]: https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub
[jb:discussions]: https://jb.gg/qodana-discussions
[jb:twitter]: https://twitter.com/Qodana
[jb:docker]: https://hub.docker.com/r/jetbrains/qodana


## Issue Tracker

All the issues, feature requests, and support related to the Qodana Azure Pipelines extension are handled on [YouTrack][youtrack].

If you'd like to file a new issue, please use the link [YouTrack | New Issue][youtrack-new-issue].