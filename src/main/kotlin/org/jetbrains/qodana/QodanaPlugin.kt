package org.jetbrains.qodana

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.jetbrains.qodana.tasks.CleanCloneFinderTask
import org.jetbrains.qodana.tasks.CleanInspectionsTask
import org.jetbrains.qodana.tasks.CleanLicenseAuditTask
import org.jetbrains.qodana.tasks.CleanTask
import org.jetbrains.qodana.tasks.RunCloneFinderTask
import org.jetbrains.qodana.tasks.RunInspectionsTask
import org.jetbrains.qodana.tasks.RunLicenseAuditTask
import org.jetbrains.qodana.tasks.RunTask
import org.jetbrains.qodana.tasks.StopCloneFinderTask
import org.jetbrains.qodana.tasks.StopInspectionsTask
import org.jetbrains.qodana.tasks.StopLicenseAuditTask
import org.jetbrains.qodana.tasks.StopTask

@Suppress("unused", "UnstableApiUsage")
class QodanaPlugin : Plugin<Project> {

    /**
     * Configure Qodana tasks and extension.
     */
    override fun apply(project: Project) {

        // `qodana {}` Extension
        val extension = project.extensions.create(QodanaPluginConstants.EXTENSION_NAME, QodanaExtension::class.java).also {
            it.projectPath.convention(project.projectDir.canonicalPath)
            it.resultsPath.convention(project.provider {
                "${it.projectPath.get()}/build/results"
            })
            it.saveReport.convention(false)
            it.showReport.convention(false)
            it.showReportPort.convention(8080)
        }

        // Inspections - `runInspections` task
        project.tasks.register(QodanaPluginConstants.RUN_INSPECTIONS_TASK_NAME, RunInspectionsTask::class.java) { task ->
            task.configure(
                extension,
                "Starts Qodana Inspections in Docker container",
                QodanaPluginConstants.DOCKER_CONTAINER_NAME_INSPECTIONS,
                QodanaPluginConstants.DOCKER_IMAGE_NAME_INSPECTIONS,
            )

            task.changes.convention(false)

            task.dockerVolumeBindings.set(project.provider {
                listOfNotNull(
                    "${task.projectDir.get().canonicalPath}:/data/project",
                    "${task.resultsDir.get().canonicalPath}:/data/results",
                    task.cacheDir.orNull?.let {
                        "${it.canonicalPath}:/data/cache"
                    },
                    task.profilePath.orNull?.let {
                        "$it:/data/profile.xml"
                    },
                    task.disabledPluginsPath.orNull?.let {
                        "$it:/root/.config/idea/disabled_plugins.txt"
                    },
                )
            })
            task.dockerEnvParameters.set(project.provider {
                listOfNotNull(
                    task.jvmParameters.get().takeIf { it.isNotEmpty() }?.let {
                        "IDE_PROPERTIES_PROPERTY=${it.joinToString(" ")}"
                    },
                )
            })
            task.arguments.set(project.provider {
                listOfNotNull(
                    "--save-report".takeIf { task.saveReport.get() },
                    "--show-report".takeIf { task.showReport.get() },
                    "-changes".takeIf { task.changes.get() }
                )
            })
        }

        // Inspections - `stopInspections` task
        project.tasks.register(QodanaPluginConstants.STOP_INSPECTIONS_TASK_NAME, StopInspectionsTask::class.java) {
            it.configure(
                "Stops Qodana Inspections Docker container",
                QodanaPluginConstants.RUN_INSPECTIONS_TASK_NAME,
            )
        }

        // Inspections - `cleanInspections` task
        project.tasks.register(QodanaPluginConstants.CLEAN_INSPECTIONS_TASK_NAME, CleanInspectionsTask::class.java) {
            it.configure(
                "Cleans up Qodana Inspections output directory",
                QodanaPluginConstants.RUN_INSPECTIONS_TASK_NAME,
            )
        }

        // Clone Finder - `runCloneFinder` task
        project.tasks.register(QodanaPluginConstants.RUN_CLONE_FINDER_TASK_NAME, RunCloneFinderTask::class.java) {
            it.configure(
                extension,
                "Starts Qodana Clone Finder in Docker container",
                QodanaPluginConstants.DOCKER_CONTAINER_NAME_CLONE_FINDER,
                QodanaPluginConstants.DOCKER_IMAGE_NAME_CLONE_FINDER,
            )
        }

        // Clone Finder - `stopCloneFinder` task
        project.tasks.register(QodanaPluginConstants.STOP_CLONE_FINDER_TASK_NAME, StopCloneFinderTask::class.java) {
            it.configure(
                "Stops Qodana Clone Finder Docker container",
                QodanaPluginConstants.RUN_CLONE_FINDER_TASK_NAME,
            )
        }

        // Clone Finder - `cleanCloneFinder` task
        project.tasks.register(QodanaPluginConstants.CLEAN_CLONE_FINDER_TASK_NAME, CleanCloneFinderTask::class.java) {
            it.configure(
                "Cleans up Qodana Clone Finder output directory",
                QodanaPluginConstants.RUN_CLONE_FINDER_TASK_NAME,
            )
        }


        // License Audit - `runLicenseAudit` task
        project.tasks.register(QodanaPluginConstants.RUN_LICENSE_AUDIT_TASK_NAME, RunLicenseAuditTask::class.java) {
            it.configure(
                extension,
                "Starts Qodana License Audit in Docker container",
                QodanaPluginConstants.DOCKER_CONTAINER_NAME_LICENSE_AUDIT,
                QodanaPluginConstants.DOCKER_IMAGE_NAME_LICENSE_AUDIT,
            )
        }

        // License Audit - `stopLicenseAudit` task
        project.tasks.register(QodanaPluginConstants.STOP_LICENSE_AUDIT_TASK_NAME, StopLicenseAuditTask::class.java) {
            it.configure(
                "Stops Qodana License Audit Docker container",
                QodanaPluginConstants.RUN_LICENSE_AUDIT_TASK_NAME,
            )
        }

        // License Audit - `cleanLicenseAudit` task
        project.tasks.register(QodanaPluginConstants.CLEAN_LICENSE_AUDIT_TASK_NAME, CleanLicenseAuditTask::class.java) {
            it.configure(
                "Cleans up Qodana License Audit output directory",
                QodanaPluginConstants.RUN_CLONE_FINDER_TASK_NAME,
            )
        }
    }

    /**
     * Configures common properties of tasks based on [RunTask].
     *
     * @param extension [QodanaExtension] instance
     * @param taskDescription current task description
     * @param containerName default Docker container name
     * @param imageName default Docker image name
     */
    private fun RunTask.configure(
        extension: QodanaExtension,
        taskDescription: String,
        containerName: String,
        imageName: String,
    ) {
        group = QodanaPluginConstants.GROUP_NAME
        description = taskDescription

        dockerContainerName.convention(containerName)
        dockerImageName.convention(imageName)
        projectDir.convention(project.provider {
            project.file(extension.projectPath)
        })
        resultsDir.convention(project.provider {
            project.file(extension.resultsPath)
        })
        cacheDir.convention(project.provider {
            extension.cachePath.orNull?.let {
                project.file(it)
            }
        })
        saveReport.convention(extension.saveReport)
        showReport.convention(extension.showReport)
        showReportPort.convention(extension.showReportPort)

        dockerPortBindings.set(project.provider {
            listOf(
                "${showReportPort.get()}:8080"
            )
        })
        dockerVolumeBindings.set(project.provider {
            listOfNotNull(
                "${projectDir.get().canonicalPath}:/data/project",
                "${resultsDir.get().canonicalPath}:/data/results",
                cacheDir.orNull?.let {
                    "${it.canonicalPath}:/data/cache"
                },
            )
        })
        arguments.set(project.provider {
            listOfNotNull(
                "--save-report".takeIf { saveReport.get() },
                "--show-report".takeIf { showReport.get() },
            )
        })
    }

    /**
     * Configures common properties of tasks based on [StopTask].
     *
     * @param taskDescription current task description
     * @param runTaskName name of the [RunTask] to use for providing default values
     */
    private fun StopTask.configure(
        taskDescription: String,
        runTaskName: String,
    ) {
        group = QodanaPluginConstants.GROUP_NAME
        description = taskDescription
        isIgnoreExitValue = true

        val runTaskProvider = project.tasks.named(runTaskName)
        val runTask = runTaskProvider.get() as RunTask
        dockerContainerName.convention(runTask.dockerContainerName)
    }

    /**
     * Configures common properties of tasks based on [CleanTask].
     *
     * @param taskDescription current task description
     * @param runTaskName name of the [RunTask] to use for providing default values
     */
    private fun CleanTask.configure(
        taskDescription: String,
        runTaskName: String,
    ) {
        group = QodanaPluginConstants.GROUP_NAME
        description = taskDescription

        val runTaskProvider = project.tasks.named(runTaskName)
        val runTask = runTaskProvider.get() as RunTask
        resultsDir.convention(runTask.resultsDir)
    }
}
