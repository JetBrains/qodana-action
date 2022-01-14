# Gradle Qodana Plugin

[![official JetBrains project](https://jb.gg/badges/official.svg)][jb:confluence-on-gh]
[![Gradle Plugin Portal](https://img.shields.io/gradle-plugin-portal/v/org.jetbrains.qodana?color=green&label=Gradle%20Plugin%20Portal&logo=gradle)][gradle-plugin-page]
[![Build](https://github.com/JetBrains/gradle-grammar-kit-plugin/workflows/Build/badge.svg)][gh:build]
[![GitHub Discussions](https://img.shields.io/github/discussions/jetbrains/qodana)][jb:discussions]
[![Twitter Follow](https://img.shields.io/twitter/follow/QodanaEvolves?style=social&logo=twitter)][jb:twitter]

Gradle interface to run code inspections from IntelliJ IDEA.

> **Important:**
> This project requires Gradle 6.6 or newer, however it is recommended to use the [latest Gradle available](https://gradle.org/releases/). Update it with:
> ```bash
> ./gradlew wrapper --gradle-version=VERSION
> ```

## Issue Tracker

All the issues, feature requests, and support related to the Gradle Qodana Plugin is handled on [YouTrack][youtrack].

If you'd like to file a new issue, please use the following [YouTrack | New Issue][youtrack-new-issue] link.

## Docker Image with Qodana tool

Docker Hub: https://hub.docker.com/r/jetbrains/qodana-jvm-community

## Gradle Qodana Configuration

> **Note:** Make sure you have `docker` already installed and available in your environment. 

Apply Gradle plugin `org.jetbrains.qodana` in Gradle configuration file:

- Groovy – `build.gradle`

  ```groovy
  plugins {
      id "org.jetbrains.qodana" version "..."
  }
  ```
  
- Kotlin DSL – `build.gradle.kts`

  ```kotlin
  plugins {
      id("org.jetbrains.qodana") version "..."
  }
  ```
  
> **Note:** The latest version is: [![Gradle Plugin Portal](https://img.shields.io/gradle-plugin-portal/v/org.jetbrains.qodana?color=green&label=Gradle%20Plugin%20Portal&logo=gradle)][gradle-plugin-page]

### `qodana { }` extension configuration
Properties available for configuration in the `qodana { }` top level configuration closure:

| Name                    | Description                                                                                                                       | Type      | Default Value                           |
|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------|-----------|-----------------------------------------|
| `autoUpdate`            | Automatically pull the latest Docker image before running the inspection.                                                         | `Boolean` | `true`                                  |
| `baselinePath`          | Run in [baseline][docs:baseline] mode. Provide the path to an existing SARIF report to be used in the baseline state calculation. | `String`  | `null`                                  |
| `baselineIncludeAbsent` | Include in the output report the results from the baseline run that are absent in the current run.                                | `Boolean` | `false`                                 |
| `cachePath`             | Path to the cache directory.                                                                                                      | `String`  | `null`                                  |
| `dockerContainerName`   | Name of the Qodana Docker container.                                                                                              | `String`  | `idea-inspections`                      |
| `dockerImageName`       | Name of the Qodana Docker image.                                                                                                  | `String`  | `jetbrains/qodana-jvm-community:latest` |
| `executable`            | Docker executable name.                                                                                                           | `String`  | `docker`                                |
| `projectPath`           | Path to the project folder to inspect.                                                                                            | `String`  | `project.projectDir`                    |
| `failThreshold`         | A number of problems that will serve as a quality gate. If this number is reached, the inspection run is terminated.              | `Int`     | `10000`                                 |
| `resultsPath`           | Path to directory to store results of the task.                                                                                   | `String`  | `"${projectPath}/build/results"`        |
| `reportPath`            | Path to the directory to store the generated report.                                                                              | `String`  | `"${projectPath}/build/results/report"` |
| `saveReport`            | Generate HTML report.                                                                                                             | `Boolean` | `false`                                 |
| `showReport`            | Serve an HTML report on `showReportPort` port.                                                                                    | `Boolean` | `false`                                 |
| `showReportPort`        | Default port used to show an HTML report.                                                                                         | `Int`     | `8080`                                  |

## Gradle Qodana Tasks

### `runInspections`

Starts Qodana Inspections in a Docker container.

Task relies on the `qodana { }` extension configuration, however it provides also additional properties and helper methods to configure the Docker image.

#### Properties

| Name                  | Description                                                                                                                       | Type           | Default Value |
|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------|----------------|---------------|
| `disabledPluginsPath` | Path to the list of plugins to be disabled in the Qodana IDE instance to be mounted as `/root/.config/idea/disabled_plugins.txt`. | `String`       | `null`        |
| `changes`             | Inspect uncommitted changes and report new problems.                                                                              | `Boolean`      | `false`       |
| `jvmParameters`       | JVM parameters to start IDEA JVM.                                                                                                 | `List<String>` | `empty`       |
| `profilePath`         | Path to the profile file to be mounted as `/data/profile.xml`.                                                                    | `String`       | `null`        |

#### Helper methods

| Name                                           | Description                                           |
|------------------------------------------------|-------------------------------------------------------|
| `bind(outerPort: Int, dockerPort: Int)`        | Adds new port binding.                                |
| `mount(outerPath: String, dockerPath: String)` | Mounts local directory to the given Docker path.      |
| `env(name: String, value: String)`             | Adds an environment variable.                         |
| `dockerArg(argument: String)`                  | Adds a Docker argument to the executed command.       |
| `arg(argument: String)`                        | Adds a Docker image argument to the executed command. |

### `updateInspections`

Pulls the latest Qodana Inspections Docker container.

Task will be run automatically before the `runInspections` if the `qodana.autoUpdate` property will be set to `true`.

### `stopInspections`

Stops the Qodana Inspections Docker container.

### `cleanInspections`

Cleans up the Qodana Inspections output directory.


## Example

Add this to your Gradle configuration file:

- Groovy – `build.gradle`

  ```groovy
  plugins {
      // applies Gradle Qodana plugin to use it in project
      id "org.jetbrains.qodana" version "..."
  }
  
  qodana {
      // by default result path is $projectPath/build/results
      resultsPath = "some/output/path"
  }
  
  runInspections {
      // by default qodana.recommended will be used
      profilePath = "./someExternallyStoredProfile.xml"  
  }
  ```

- Kotlin – `build.gradle.kts`

  ```kotlin
  plugins {
      // applies Gradle Qodana plugin to use it in project
      id("org.jetbrains.qodana") version "..."
  }
  
  qodana {
      // by default result path is $projectPath/build/results
      resultsPath.set("some/output/path")
  }
  
  tasks {
      runInspections {
          // by default qodana.recommended will be used
          profilePath.set("./someExternallyStoredProfile.xml")
      }
  }
  ```

> **Note:** Docker requires at least 4GB of memory. Set it in Docker `Preferences > Resources > Memory` section.

Now you can run inspections with `runInspections` Gradle task:

```bash
gradle runInspections 
// or
./gradlew runInspections
```

Full guide for options and configuration parameters could be found on [qodana docs page](https://www.jetbrains.com/help/qodana/qodana-jvm-docker-techs.html). 

## Build Locally

### Build 

Execute Gradle task `publishToMavenLocal` to build Gradle Qodana Plugin and publish it into local Maven repository.
By default, plugin will be published into `~/.mvn/org/jetbrains/qodana/` directory.

### Apply

Add Maven local repository into available repositories in your Gradle project.
For this you need to add following lines at the beginning of `settings.gradle[.kts]` file:

```groovy
pluginManagement {
    repositories {
        mavenLocal()
        gradlePluginPortal()
    }
}
```

Apply Gradle Qodana Plugin with snapshot version in Gradle configuration file and mount the Maven Local directory:

- Groovy – `build.gradle`

  ```groovy
  plugins {
      id "org.jetbrains.qodana" version "0.1.0-SNAPSHOT"
  }
  
  qodana {
      mount("/Users/me/.m2", "/root/.m2")
  }
  ```

- Kotlin DSL – `build.gradle.kts`

  ```kotlin
  plugins {
      id("org.jetbrains.qodana") version "0.1.0-SNAPSHOT"
  }

  qodana {
      mount("/Users/me/.m2", "/root/.m2")
  }
  ```

[docs:baseline]: https://www.jetbrains.com/help/qodana/qodana-intellij-docker-techs.html#Run+in+baseline+mode
[gh:build]: https://github.com/JetBrains/gradle-qodana-plugin/actions?query=workflow%3ABuild
[gradle-plugin-page]: https://plugins.gradle.org/plugin/org.jetbrains.qodana
[jb:confluence-on-gh]: https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub
[jb:discussions]: https://jb.gg/qodana-discussions
[jb:twitter]: https://twitter.com/QodanaEvolves
[youtrack]: https://youtrack.jetbrains.com/issues/QD
[youtrack-new-issue]: https://youtrack.jetbrains.com/newIssue?project=QD&c=Platform%20Gradle%20Plugin&c=Tool%20IntelliJ%20(Code%20Inspection)
[youtrack]: https://youtrack.jetbrains.com/issues/QD
[youtrack-new-issue]: https://youtrack.jetbrains.com/newIssue?project=QD&c=Platform%20Gradle%20Plugin&c=Tool%20IntelliJ%20(Code%20Inspection)
