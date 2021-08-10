package org.jetbrains.qodana

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.jetbrains.qodana.tasks.CleanInspectionsTask
import org.jetbrains.qodana.tasks.RunInspectionsTask
import org.jetbrains.qodana.tasks.StopInspectionsTask

@Suppress("unused", "UnstableApiUsage")
class QodanaPlugin : Plugin<Project> {

    override fun apply(project: Project) {
        val projectDir = project.projectDir

        val extension = project.extensions.create(QodanaPluginConstants.EXTENSION_NAME, QodanaExtension::class.java).also {
            it.projectPath.convention(projectDir.canonicalPath)
            it.resultsPath.convention(project.provider {
                "${it.projectPath.get()}/build/results"
            })
            it.jvmParameters.convention(emptyList())
            it.dockerImageName.convention(QodanaPluginConstants.DEFAULT_DOCKER_IMAGE_NAME)
            it.dockerContainerName.convention(QodanaPluginConstants.DEFAULT_DOCKER_CONTAINER_NAME)
        }

        project.tasks.register(QodanaPluginConstants.RUN_INSPECTIONS_TASK_NAME, RunInspectionsTask::class.java) {
            it.group = QodanaPluginConstants.GROUP_NAME
            it.description = "Starts Qodana in Docker container"

            it.dockerContainerName.convention(extension.dockerContainerName)
            it.dockerImageName.convention(extension.dockerImageName)
            it.dockerPortBindings.convention(extension.dockerPortBindings)
            it.dockerVolumeBindings.convention(extension.dockerVolumeBindings)
            it.dockerEnvParameters.convention(extension.dockerEnvParameters)
            it.dockerArguments.convention(extension.dockerArguments)
        }

        project.tasks.register(QodanaPluginConstants.STOP_INSPECTIONS_TASK_NAME, StopInspectionsTask::class.java) {
            it.group = QodanaPluginConstants.GROUP_NAME
            it.description = "Stops Docker container with Qodana"
            it.isIgnoreExitValue = true

            it.dockerContainerName.convention(extension.dockerContainerName)
        }

        project.tasks.register(QodanaPluginConstants.CLEAN_INSPECTIONS_TASK_NAME, CleanInspectionsTask::class.java) {
            it.group = QodanaPluginConstants.GROUP_NAME
            it.description = "Cleans up Qodana output directory"

            it.resultsPath.convention(extension.resultsPath)
        }

        project.afterEvaluate {
            extension.mount(extension.projectPath.get(), "/data/project")
            extension.mount(extension.resultsPath.get(), "/data/results")
            extension.profilePath.orNull?.let {
                extension.mount(it, "/data/profile.xml")
            }
            extension.disabledPluginsPath.orNull?.let {
                extension.mount(it, "/root/.config/idea/disabled_plugins.txt")
            }
            extension.jvmParameters.get().takeIf { it.isNotEmpty() }?.let {
                extension.env("IDE_PROPERTIES_PROPERTY", it.joinToString(" "))
            }
        }
    }
}
