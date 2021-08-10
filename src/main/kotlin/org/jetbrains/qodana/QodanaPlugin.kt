package org.jetbrains.qodana

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.Delete
import org.gradle.api.tasks.Exec
import org.jetbrains.qodana.tasks.CleanInspectionsTask
import org.jetbrains.qodana.tasks.RunInspectionsTask
import org.jetbrains.qodana.tasks.StopInspectionsTask
import java.io.File

@Suppress("unused")
class QodanaPlugin : Plugin<Project> {

    override fun apply(project: Project) {
        val extension = project.extensions.create(QodanaPluginConstants.EXTENSION_NAME, QodanaExtension::class.java)

        val runInspections = project.tasks.register(QodanaPluginConstants.RUN_INSPECTIONS_TASK_NAME, RunInspectionsTask::class.java) {
            it.group = QodanaPluginConstants.GROUP_NAME
            it.description = "Starts Qodana in Docker container"
        }
        val stopInspections = project.tasks.register(QodanaPluginConstants.STOP_INSPECTIONS_TASK_NAME, StopInspectionsTask::class.java) {
            it.group = QodanaPluginConstants.GROUP_NAME
            it.description = "Stops Docker container with Qodana"
            it.isIgnoreExitValue = true
        }
        val cleanInspections = project.tasks.register(QodanaPluginConstants.CLEAN_INSPECTIONS_TASK_NAME, CleanInspectionsTask::class.java) {
            it.group = QodanaPluginConstants.GROUP_NAME
            it.description = "Cleans up Qodana output directory"
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

            runInspections.get().apply {
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
                args("--mount", "type=volume,dst=/data/project/.gradle")
                args(extension.dockerArguments)
                args(dockerImageName)
            }
            stopInspections.get().apply {
                executable = "docker"
                args("stop", dockerContainerName)
            }
            cleanInspections.get().apply {
                delete(resultsPath)
            }
        }
    }
}
