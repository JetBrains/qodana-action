# Qodana for Gradle

[![official JetBrains project](https://jb.gg/badges/official.svg)][jb:confluence-on-gh]
[![Gradle Plugin Portal](https://img.shields.io/gradle-plugin-portal/v/org.jetbrains.qodana?color=green&label=Gradle%20Plugin%20Portal&logo=gradle)][gradle-plugin-page]
[![Build](https://github.com/JetBrains/gradle-grammar-kit-plugin/workflows/Build/badge.svg)][gh:build]
[![GitHub Discussions](https://img.shields.io/github/discussions/jetbrains/qodana)][jb:discussions]
[![Twitter Follow](https://img.shields.io/badge/follow-%40Qodana-1DA1F2?logo=twitter)][jb:twitter]

Gradle interface to run [Qodana](https://jetbrains.com/qodana)

> **Important:**
> This project requires Gradle 6.6 or newer, however it is recommended to use the [latest Gradle available](https://gradle.org/releases/). Update it with:
> ```bash
> ./gradlew wrapper --gradle-version=VERSION
> ```

## Gradle Qodana Configuration

> **Note:** Make sure you have `docker` already installed and available in your environment if you want to run Qodana in a container.

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

| Name             | Description                                          | Type      | Default Value                           |
|------------------|------------------------------------------------------|-----------|-----------------------------------------|
| `projectPath`    | Path to the project folder to inspect.               | `String`  | `project.projectDir`                    |
| `resultsPath`    | Path to directory to store results of the task.      | `String`  | `"${projectPath}/build/qodana/results"` |
| `cachePath`      | Path to the directory to store the generated report. | `String`  | `"${projectPath}/build/qodana/cache/"`  |

## Gradle Qodana Tasks

### `qodanaScan`

Starts Qodana in a Docker container in the project directory.

Task relies on the `qodana { }` extension configuration, however it is also controlled by provided `arguments`.


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
  
  qodanaScan {
      arguments = ["--fail-threshold", "0"]
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
  
  qodanaScan {
      resultsPath.set("some/output/path")
      arguments.set(listOf("--fail-threshold", "0"))
  }
  ```

> **Note:** Docker requires at least 4GB of memory. Set it in Docker `Preferences > Resources > Memory` section.

Now you can run inspections with `qodanaScan` Gradle task:

```bash
gradle qodanaScan 
// or
./gradlew qodanaScan
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
  }
  ```

- Kotlin DSL – `build.gradle.kts`

  ```kotlin
  plugins {
      id("org.jetbrains.qodana") version "0.1.0-SNAPSHOT"
  }

  qodana {
  }
  ```

[docs:baseline]: https://www.jetbrains.com/help/qodana/qodana-intellij-docker-techs.html#Run+in+baseline+mode
[gh:build]: https://github.com/JetBrains/gradle-qodana-plugin/actions?query=workflow%3ABuild
[gradle-plugin-page]: https://plugins.gradle.org/plugin/org.jetbrains.qodana
[jb:confluence-on-gh]: https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub
[jb:discussions]: https://jb.gg/qodana-discussions
[jb:twitter]: https://twitter.com/Qodana
[youtrack]: https://youtrack.jetbrains.com/issues/QD
[youtrack-new-issue]: https://youtrack.jetbrains.com/newIssue?project=QD&c=Platform%20Gradle%20Plugin&c=Tool%20IntelliJ%20(Code%20Inspection)
[youtrack]: https://youtrack.jetbrains.com/issues/QD
[youtrack-new-issue]: https://youtrack.jetbrains.com/newIssue?project=QD&c=Platform%20Gradle%20Plugin&c=Tool%20IntelliJ%20(Code%20Inspection)
