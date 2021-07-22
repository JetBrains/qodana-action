# Gradle Qodana Plugin
Gradle interface to run code inspections from Intellij IDEA

## Docker Image with Qodana tool

Docker Hub: https://hub.docker.com/r/jetbrains/qodana

## Gradle Qodana Tasks

* `runInspections` starts Qodana inspections in docker container
* `stopInspections` stops docker container with Qodana
* `cleanInspections` cleanups Qodana output directory

## Gradle Qodana Configuration

Apply Gradle plugin `org.jetbrains.qodana` in `build.gradle`
```
plugins {
    id 'org.jetbrains.qodana' version "0.1.5"
}
```
Elements to configure plugin available in `qodana { }` top level configuration group:

* `projectPath` path to project on local machine
* `resultsPath` path to directory where should be 
* `profilePath` path to Qodana profile file
* `disabledPluginsPath` path to file that describes disabled IDEA plugins
* `jvmParameters` JVM parameters to start IDEA JVM


* `bind(local port, docker port)` binds port between local machine and docker container
* `mount(local path, docker path)` mounts directory between local machine and docker container
* `env(name, value)` defines environment variable


* `dockerImageName` name of docker image with Qodana tool
* `dockerContainerName` docker container name to identify qodana container
* `dockerPortBindings` bounded docker and local ports
* `dockerVolumeBindings` mounted docker and local directories
* `dockerEnvParameters` defined environment variables
* `dockerArguments` custom docker arguments to start docker container with Qodana tool

### Simple example
Add this to your build.gradle:
```

plugins {
    // applies Gradle Qodana plugin to use it in project
    id 'org.jetbrains.qodana' version "0.1.5"
}

qodana {
    //by default qodana.recommended will be used
    profilePath = "./someExternalyStoredProfile.xml
    //by deffault result path is $projectPath/build/results
    resultsPath = "some/output/path"
}
```

and then you can run inspections by 
```
gradle runInspections 
//or
./gradlew runInspections
```

Full guide for options and configuration parameters could be found on [qodana docs page](https://www.jetbrains.com/help/qodana/qodana-intellij-docker-readme.html#Using+an+existing+profile) 

## Build Locally

### Build 

Execute Gradle task `publishToMavenLocal` to build Qodana plugin and publish it into local maven repository.
By default, plugin will be published into `~/.mvn/org/jetbrins/qodana/` directory.

### Apply

Add maven local repository into available repositories in your Gradle project.
For this you need to add following lines at the beginning of `settings.gradle[.kts]` file:
```
pluginManagement {
    repositories {
        // Add maven local repository
        mavenLocal()
        // Add defulat plugins repository
        gradlePluginPortal()
    }
}
```
Apply Qodana plugin with snapshot version in `build.gradle` file:
```
plugins {
    id 'org.jetbrains.qodana' version "0.1.0-SNAPSHOT"
}
```
