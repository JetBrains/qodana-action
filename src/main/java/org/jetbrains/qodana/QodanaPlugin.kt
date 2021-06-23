package org.jetbrains.qodana

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.Delete
import org.gradle.api.tasks.Exec
import java.io.File

@Suppress("unused")
class QodanaPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val extension = project.extensions.create("qodana", QodanaExtension::class.java)
        val runInspections = project.tasks.create("runInspections", Exec::class.java).apply {
            group = "Qodana"
            description = "Starts Qodana in docker container"
        }
        val stopInspections = project.tasks.create("stopInspections", Exec::class.java).apply {
            group = "Qodana"
            description = "Stops docker container with Qodana"
            isIgnoreExitValue = true
        }
        val cleanInspections = project.tasks.create("cleanInspections", Delete::class.java).apply {
            group = "Qodana"
            description = "Cleanups Qodana output directory"
        }

        project.afterEvaluate {
            val projectPath = extension.projectPath ?: project.projectDir.path
            val resultsPath = extension.resultsPath ?: "$projectPath/build/results"
            val profilePath = extension.profilePath
            val disabledPluginsPath = extension.disabledPluginsPath

            val dockerImageName = extension.dockerImageName ?: "jetbrains/qodana:latest"
            val dockerContainerName = extension.dockerContainerName ?: "idea-inspections"

            extension.mount(projectPath, "/data/project")
            extension.mount(resultsPath, "/data/results")
            if (profilePath != null) {
                extension.mount(profilePath, "/data/profile.xml")
            }
            if (disabledPluginsPath != null) {
                extension.mount(disabledPluginsPath, "/root/.config/idea/disabled_plugins.txt")
            }
            if (extension.jvmParameters.isNotEmpty()) {
                extension.env("IDE_PROPERTIES_PROPERTY", extension.jvmParameters.joinToString(" "))
            }

            runInspections.apply {
                executable = "docker"
                args("run")
                args("--label", "org.jetbrains.analysis=inspection")
                args("--rm")
                args("--name", dockerContainerName)
                extension.dockerPortBindings
                    .forEach { (outer, docker) -> args("-p", "$outer:$docker") }
                extension.dockerVolumeBindings
                    .map { (outer, docker) -> File(outer).canonicalPath to docker }
                    .forEach { (outer, docker) -> args("-v", "$outer:$docker") }
                extension.dockerEnvParameters
                    .forEach { (name, value) -> args("-e", "$name=$value") }
                args(extension.dockerArguments)
                args(dockerImageName)
            }
            stopInspections.apply {
                executable = "docker"
                args("stop", dockerContainerName)
            }
            cleanInspections.apply {
                delete(resultsPath)
            }
        }
    }
}