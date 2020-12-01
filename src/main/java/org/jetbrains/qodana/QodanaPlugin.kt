package org.jetbrains.qodana

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.Exec
import java.io.File

class QodanaPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val extension = project.extensions.create("qodana", QodanaExtension::class.java)
        val inspections = project.tasks.create("inspections", Exec::class.java).apply {
            group = "Qodana"
            description = "Starts Qodana in docker container"
        }
        val cleanInspections = project.tasks.create("cleanInspections", Exec::class.java).apply {
            group = "Qodana"
            description = "Stops docker container with Qodana and cleanup output directory"
            isIgnoreExitValue = true
        }

        project.afterEvaluate {
            val projectDir = extension.projectPath?.let(::File) ?: project.projectDir
            val resultsDir = extension.resultsPath?.let(::File) ?: File(project.projectDir, "build/results")
            val profileFile = extension.profilePath?.let(::File)
            val disabledPluginsFile = extension.disabledPluginsPath?.let(::File)

            val dockerImageName = extension.dockerImageName ?: "jetbrains/qodana:2020.3-eap"
            val dockerContainerName = extension.dockerContainerName ?: "idea-inspections"

            val dockerVolumeBindings = HashMap(extension.dockerVolumeBindings).apply {
                put(projectDir.canonicalPath, "/data/project")
                put(resultsDir.canonicalPath, "/data/results")
                profileFile?.let { put(it.canonicalPath, "/data/profile.xml") }
                disabledPluginsFile?.let { put(it.canonicalPath, "/root/.config/idea/disabled_plugins.txt") }
            }
            val dockerEnvParameters = HashMap(extension.dockerEnvParameters).apply {
                if (extension.jvmParameters.isNotEmpty()) {
                    put("IDE_PROPERTIES_PROPERTY", extension.jvmParameters.joinToString(" "))
                }
            }
            val dockerPortBindings = HashMap(extension.dockerPortBindings).apply {
            }

            inspections.apply {
                executable = "docker"
                args("run")
                args("--label", "org.jetbrains.analysis=inspection")
                args("--rm")
                args("--name", dockerContainerName)
                dockerPortBindings.forEach { (from, to) -> args("-p", "$from:$to") }
                dockerVolumeBindings.forEach { (from, to) -> args("-v", "$from:$to") }
                dockerEnvParameters.forEach { (name, value) -> args("-e", "$name=$value") }
                args(extension.dockerArguments)
                args(dockerImageName)
            }
            cleanInspections.apply {
                executable = "docker"
                args("stop", dockerContainerName)

                doLast {
                    project.delete(resultsDir)
                }
            }
        }
    }
}