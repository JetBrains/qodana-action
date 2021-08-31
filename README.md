[![official JetBrains project](https://jb.gg/badges/official.svg)][jb:confluence-on-gh]
[![Twitter Follow](https://img.shields.io/twitter/follow/QodanaEvolves?style=flat)][jb:twitter]
[![Build](https://github.com/JetBrains/gradle-grammar-kit-plugin/workflows/Build/badge.svg)][gh:build]
[![Slack](https://img.shields.io/badge/Slack-%23qodana-blue)][jb:slack]

# Gradle Qodana Plugin

Gradle interface to run code inspections from Intellij IDEA.

## Docker Image with Qodana tool

Docker Hub: https://hub.docker.com/r/jetbrains/qodana

## Gradle Qodana Configuration

> **Note:** Make sure you have `docker` already installed and available in your environment. 

Apply Gradle plugin `org.jetbrains.qodana` in Gradle configuration file:

- Groovy – `build.gradle`

  ```groovy
  plugins {
      id "org.jetbrains.qodana" version "0.1.8"
  }
  ```
  
- Kotlin DSL – `build.gradle.kts`

  ```kotlin
  plugins {
      id("org.jetbrains.qodana") version "0.1.8"
  }
  ```

### `qodana { }` extension configuration
Properties available for configuration in the `qodana { }` top level configuration closure:

| Name                  | Description                                                               | Type      | Default Value                    |
| --------------------- | ------------------------------------------------------------------------- | --------- | -------------------------------- |
| `autoUpdate`          | Automatically pull the latest Docker image before running the inspection. | `Boolean` | `true`                           |
| `cachePath`           | Path to the cache directory.                                              | `String`  | `null`                           |
| `dockerContainerName` | Name of the Qodana Docker container.                                      | `String`  | `idea-inspections`               |
| `dockerImageName`     | Name of the Qodana Docker image.                                          | `String`  | `jetbrains/qodana:latest`        |
| `executable`          | Docker executable name.                                                   | `String`  | `docker`                         |
| `projectPath`         | Path to the project folder to inspect.                                    | `String`  | `project.projectDir`             |
| `resultsPath`         | Path to directory to store results of the task.                           | `String`  | `"${projectPath}/build/results"` |
| `saveReport`          | Generate HTML report.                                                     | `Boolean` | `false`                          |
| `showReport`          | Serve an HTML report on `showReportPort` port.                            | `Boolean` | `false`                          |
| `showReportPort`      | Default port used to show an HTML report.                                 | `Int`     | `8080`                           |

## Gradle Qodana Tasks

### `runInspections`

Starts Qodana Inspections in a Docker container.

Task relies on the `qodana { }` extension configuration, however it provides also additional properties and helper methods to configure the Docker image.

#### Properties

| Name                  | Description                                                                                                                      | Type           | Default Value |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------- |
| `profilePath`         | Path to the profile file to be mounted as `/data/profile.xml`.                                                                   | `String`       | `null`        |
| `disabledPluginsPath` | Path to the list of plugins to be disabled in the Qodana IDE instance to be mounted as `/root/.config/idea/disabled_plugins.txt` | `String`       | `null`        |
| `changes`             | Inspect uncommitted changes and report new problems.                                                                             | `Boolean`      | `false`       |
| `jvmParameters`       | JVM parameters to start IDEA JVM.                                                                                                | `List<String>` | `empty`       |

#### Helper methods

| Name                                            | Description                                           |
| ----------------------------------------------- | ----------------------------------------------------- |
| `bind(outerPort: Int, dockerPort: Int)`         | Adds new port binding.                                |
| `mount(outerPath: String, dockerPath: String)`  | Mounts local directory to the given Docker path.      |
| `env(name: String, value: String)`              | Adds an environment variable.                         |
| `dockerArg(argument: String)`                   | Adds a Docker argument to the executed command.       |
| `arg(argument: String)`                         | Adds a Docker image argument to the executed command. |

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
      id "org.jetbrains.qodana" version "0.1.8"
  }
  
  qodana {
      // by default qodana.recommended will be used
      profilePath = "./someExternallyStoredProfile.xml"

      // by default result path is $projectPath/build/results
      resultsPath = "some/output/path"
  }
  ```

- Kotlin – `build.gradle.kts`

  ```kotlin
  plugins {
      // applies Gradle Qodana plugin to use it in project
      id("org.jetbrains.qodana") version "0.1.8"
  }
  
  qodana {
      // by default qodana.recommended will be used
      profilePath.set("./someExternallyStoredProfile.xml")

      // by default result path is $projectPath/build/results
      resultsPath.set("some/output/path")
  }
  ```

> **Note:** Docker requires at least 4GB of memory. Set it in Docker `Preferences > Resources > Memory` section.

Now you can run inspections with `runInspections` Gradle task:

```bash
gradle runInspections 
// or
./gradlew runInspections
```

Full guide for options and configuration parameters could be found on [qodana docs page](https://www.jetbrains.com/help/qodana/qodana-intellij-docker-readme.html#Using+an+existing+profile). 

## Build Locally

### Build 

Execute Gradle task `publishToMavenLocal` to build Gradle Qodana Plugin and publish it into local Maven repository.
By default, plugin will be published into `~/.mvn/org/jetbrins/qodana/` directory.

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

[gh:build]: https://github.com/JetBrains/gradle-qodana-plugin/actions?query=workflow%3ABuild
[jb:confluence-on-gh]: https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub
[jb:slack]: https://qodana.slack.com
[jb:twitter]: https://twitter.com/QodanaEvolves
