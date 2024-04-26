# Contributing

By participating in this project, you agree to abide by our [Code of conduct](.github/CODE_OF_CONDUCT.md).

## Set up your machine

- Qodana Scan GitHub Action and Qodana for Azure are written in [TypeScript](https://www.typescriptlang.org). 
- CircleCI Orb is written in YAML (but uses CLI under the hood similar way Qodana for Azure does).
- Qodana for Gradle plugin is written in [Kotlin](https://kotlinlang.org).

Prerequisites:

- [Node.js 12.x](https://nodejs.org/)
- Java 11

Other things you might need to develop:

- [IntelliJ IDEA](https://www.jetbrains.com/idea/) (it's [free for open-source development](https://www.jetbrains.com/community/opensource/))

Clone the repository anywhere:

```sh
git clone git@github.com:JetBrains/qodana-action.git
```

Install all dependencies:

```sh
npm install
```

Run everything in all subprojects:

```sh
npm run all
```

### GitHub action

`cd` into the project directory

```sh
cd scan
```

Build the project:

```sh
npm run build
```

Lint your code with [ESLint](https://eslint.org/):

```sh
npm run lint
```

### Azure extension

`cd` into the project directory:

```sh
cd vsts
```

Build the project:

```sh
npm run build
```

Lint your code with [ESLint](https://eslint.org/):

```sh
npm run lint
```

Run all required commands to check everything locally for the release:

```sh
npm run all
```

Update the version – edit the following artifacts:

- [ ] [vsts/vss-extension.json](vsts/vss-extension.json)
- [ ] [vsts/vss-extension.dev.json](vsts/vss-extension.dev.json)
- [ ] [vsts/QodanaScan/task.json](vsts/QodanaScan/task.json)

If you forget to do this, repository tests will fail.

Test extension packing:

```sh
npm run azure-dev
```

Also, if you change [vsts/vss-extension.dev.json](vsts/vss-extension.dev.json), release job will automatically publish the test version of an extension. 

### CircleCI orb

`cd` into the project directory:

```sh
cd src
```

There are no tests to check or run locally, so just push your changes to the pull request, they will be run on CircleCI automatically.

### Gradle plugin

#### Build

Execute Gradle task `publishToMavenLocal` to build Gradle Qodana Plugin and publish it into local Maven repository.
By default, plugin will be published into `~/.mvn/org/jetbrains/qodana/` directory.

#### Apply

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
      id "org.jetbrains.qodana" version "2024.1.0-SNAPSHOT"
  }
  
  qodana {
  }
  ```

- Kotlin DSL – `build.gradle.kts`

  ```kotlin
  plugins {
      id("org.jetbrains.qodana") version "2024.1.0-SNAPSHOT"
  }

  qodana {
  }
  ```

## Create a commit

Commit messages should be well formatted, and to make that "standardized", we are using Gitmoji.

You can follow the documentation on
[their website](https://gitmoji.dev).


## Submit a pull request

Push your branch to your `qodana-action` fork and open a pull request against the
main branch.

## Release a new version

Because every extension depends on CLI,
extensions follow the [CLI versioning](https://github.com/JetBrains/qodana-cli/releases) scheme.
When a new CLI release is published, a pull request with the update is automatically created in this repository
([example](https://github.com/JetBrains/qodana-action/pull/293))

If you are a core maintainer and want to release a new version, all you need is to run the following command:

```shell
git tag -a vX.X.X -m "vX.X.X" && git push origin vX.X.X
```

And [our GitHub Actions job `Release`](https://github.com/JetBrains/qodana-action/actions/workflows/release.yml) will do the rest.

Note that Gradle, GitHub action, CircleCI orb and Azure extension are always released together. 
The release will be published to:

- [GitHub Marketplace](https://github.com/marketplace/actions/qodana-scan)
- [Azure DevOps Marketplace](https://marketplace.visualstudio.com/items?itemName=JetBrains.qodana)
- [CircleCI Orb Registry](https://circleci.com/developer/orbs/orb/jetbrains/qodana)
- [Gradle Plugin Portal](https://plugins.gradle.org/plugin/org.jetbrains.qodana)
