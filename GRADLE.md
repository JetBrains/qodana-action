# Qodana for Gradle

[![official JetBrains project](https://jb.gg/badges/official.svg)][jb:confluence-on-gh]
[![Gradle Plugin Portal](https://img.shields.io/gradle-plugin-portal/v/org.jetbrains.qodana?color=green&label=Gradle%20Plugin%20Portal&logo=gradle)][gradle-plugin-page]
[![GitHub Discussions](https://img.shields.io/github/discussions/jetbrains/qodana)][jb:discussions]
[![Twitter Follow](https://img.shields.io/badge/follow-%40Qodana-1DA1F2?logo=twitter)][jb:twitter]

Gradle interface to run [Qodana](https://jetbrains.com/qodana)

> **Important:**
> This project requires Gradle 6.6 or newer; however, it is recommended to use the [latest Gradle available](https://gradle.org/releases/). Update it with:
> ```bash
> ./gradlew wrapper --gradle-version=VERSION
> ```

## Gradle Configuration

> **Note:** Make sure you have `docker` installed and available in your environment if you want to run Qodana in a container.

Apply Gradle plugin `org.jetbrains.qodana` in the Gradle configuration file:

- Groovy – `build.gradle`

  ```groovy
  plugins {
      id "org.jetbrains.qodana" version "2024.1.5"
  }
  ```

- Kotlin DSL – `build.gradle.kts`

  ```kotlin
  plugins {
      id("org.jetbrains.qodana") version "2024.1.5"
  }
  ```

> **Note:** The latest version is: [![](https://img.shields.io/gradle-plugin-portal/v/org.jetbrains.qodana?color=green&label=Gradle%20Plugin%20Portal&logo=gradle)](https://plugins.gradle.org/plugin/org.jetbrains.qodana)

### `qodana { }` extension configuration
Properties available for configuration in the `qodana { }` top-level configuration closure:

| Name             | Description                                          | Type      | Default Value                           |
|------------------|------------------------------------------------------|-----------|-----------------------------------------|
| `projectPath`    | Path to the project folder to inspect.               | `String`  | `project.projectDir`                    |
| `resultsPath`    | Path to the directory to store task results.         | `String`  | `"${projectPath}/build/qodana/results"` |
| `cachePath`      | Path to the directory to store the generated report. | `String`  | `"${projectPath}/build/qodana/cache/"`  |

## Gradle Qodana Tasks

### `qodanaScan`

Start Qodana in the project directory.

The task relies on the `qodana { }` extension configuration. However, it is also controlled by provided `arguments`.


### Example

Add this to your Gradle configuration file:

- Groovy – `build.gradle`

  ```groovy
  plugins {
      // applies Gradle Qodana plugin to use it in project
      id "org.jetbrains.qodana" version "2024.1.5"
  }
  
  qodana {
      // by default result path is $projectPath/build/results
      resultsPath = "some/output/path"
  }
  
  tasks.qodanaScan {
      arguments = ["--fail-threshold", "0"]
  }
  ```

- Kotlin – `build.gradle.kts`

  ```kotlin
  plugins {
      // applies Gradle Qodana plugin to use it in project
      id("org.jetbrains.qodana") version "2024.1.5"
  }
  
  qodana {
      // by default result path is $projectPath/build/results
      resultsPath.set("some/output/path")
  }
  
  tasks.qodanaScan {
      resultsPath.set("some/output/path")
      arguments.set(listOf("--fail-threshold", "0"))
  }
  ```

> **Note:** Docker requires at least 4GB of memory. Set it in the Docker `Preferences > Resources > Memory` section.

Now you can run inspections with `qodanaScan` Gradle task:

```bash
gradle qodanaScan 
// or
./gradlew qodanaScan
```

A complete guide for options and configuration of `arguments` parameters can be found on [Qodana CLI docs page]((https://github.com/JetBrains/qodana-cli#scan)).

[gh:build]: https://github.com/JetBrains/gradle-qodana-plugin/actions?query=workflow%3ABuild
[gradle-plugin-page]: https://plugins.gradle.org/plugin/org.jetbrains.qodana
[jb:confluence-on-gh]: https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub
[jb:discussions]: https://jb.gg/qodana-discussions
[jb:twitter]: https://twitter.com/Qodana
[youtrack]: https://youtrack.jetbrains.com/issues/QD
[youtrack-new-issue]: https://youtrack.jetbrains.com/newIssue?project=QD&c=Platform%20Gradle%20Plugin&c=Tool%20IntelliJ%20(Code%20Inspection)
[youtrack]: https://youtrack.jetbrains.com/issues/QD
[youtrack-new-issue]: https://youtrack.jetbrains.com/newIssue?project=QD&c=Platform%20Gradle%20Plugin&c=Tool%20IntelliJ%20(Code%20Inspection)
