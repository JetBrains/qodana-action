# Qodana for Maven

[![official JetBrains project](https://jb.gg/badges/official.svg)][jb:confluence-on-gh]
[![GitHub Discussions](https://img.shields.io/github/discussions/jetbrains/qodana)][jb:discussions]
[![Twitter Follow](https://img.shields.io/badge/follow-%40Qodana-1DA1F2?logo=twitter)][jb:twitter]

Maven interface to run [Qodana](https://jetbrains.com/qodana)

> **Important:**
> This project requires Maven 3.6 or newer. Update it with your package manager or download from [Maven website](https://maven.apache.org/download.cgi).

## Maven Configuration

> **Note:** Make sure you have `docker` installed and available in your environment if you want to run Qodana in a container.

Add the Qodana Maven plugin to your `pom.xml`:

```xml
<build>
    <plugins>
        <plugin>
            <groupId>io.github.qodana</groupId>
            <artifactId>qodana-maven-plugin</artifactId>
            <version>2025.3.1</version>
        </plugin>
    </plugins>
</build>
```

### Plugin Configuration

Properties available for configuration in the plugin:

| Name         | Description                                  | Type           | Default Value                                |
|--------------|----------------------------------------------|----------------|----------------------------------------------|
| `projectDir` | Path to the project folder to inspect.       | `File`         | `${project.basedir}`                         |
| `resultsDir` | Path to the directory to store results.      | `File`         | `${project.build.directory}/qodana/results`  |
| `cacheDir`   | Path to the directory to store cache.        | `File`         | `${project.build.directory}/qodana/cache`    |
| `qodanaDir`  | Path to store the Qodana CLI binary.         | `File`         | `${project.build.directory}/qodana`          |
| `arguments`  | List of custom Qodana CLI `scan` arguments.  | `List<String>` | `[]`                                         |
| `useNightly` | Use a nightly version of Qodana CLI.         | `Boolean`      | `false`                                      |

## Maven Qodana Goals

### `qodana:scan`

Start Qodana analysis in the project directory.

The goal downloads the Qodana CLI binary automatically (with checksum verification) and executes it with the configured arguments.

### Example

Add this to your `pom.xml`:

```xml
<build>
    <plugins>
        <plugin>
            <groupId>io.github.qodana</groupId>
            <artifactId>qodana-maven-plugin</artifactId>
            <version>2025.3.1</version>
            <configuration>
                <resultsDir>${project.build.directory}/qodana/results</resultsDir>
                <arguments>
                    <argument>--fail-threshold</argument>
                    <argument>0</argument>
                </arguments>
            </configuration>
        </plugin>
    </plugins>
</build>
```

Now you can run inspections with the `qodana:scan` goal:

```bash
mvn qodana:scan
```

### Command Line Configuration

All parameters can be overridden from the command line:

```bash
# Basic scan
mvn qodana:scan

# With custom arguments
mvn qodana:scan -Dqodana.arguments="--fail-threshold,0"

# Custom results directory
mvn qodana:scan -Dqodana.resultsDir=/path/to/results
```

> **Note:** Docker requires at least 4GB of memory. Set it in the Docker `Preferences > Resources > Memory` section.

A complete guide for options and configuration of `arguments` parameters can be found on [Qodana CLI docs page](https://github.com/JetBrains/qodana-cli#scan).


[jb:confluence-on-gh]: https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub
[jb:discussions]: https://jb.gg/qodana-discussions
[jb:twitter]: https://twitter.com/Qodana
