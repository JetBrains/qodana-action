package org.jetbrains.qodana

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.PluginInstantiationException
import org.jetbrains.qodana.tasks.QodanaScanTask

class QodanaPlugin : Plugin<Project> {

    /**
     * Configure Qodana tasks and extension.
     */
    override fun apply(project: Project) {
        if (Version.parse(project.gradle.gradleVersion) < Version.parse("6.6")) {
            throw PluginInstantiationException("gradle-qodana-plugin requires Gradle 6.6 and higher")
        }

        // `qodana {}` Extension
        val extension = project.extensions.create(QodanaPluginConstants.EXTENSION_NAME, QodanaPluginExtension::class.java).also { ext ->
            ext.projectPath.convention(project.projectDir.canonicalPath)
            ext.resultsPath.convention(project.provider {
                "${ext.projectPath.get()}/build/qodana/results"
            })
            ext.cachePath.convention(project.provider {
                "${ext.projectPath.get()}/build/qodana/cache"
            })
            ext.qodanaPath.convention(project.provider {
                "${ext.projectPath.get()}/build/qodana/${Installer.getVersion()}/qodana${Installer.getExtension()}"
            })
        }

        // `qodanaScan` task
        project.tasks.register(QodanaPluginConstants.QODANA_SCAN_TASK_NAME, QodanaScanTask::class.java) {
            group = QodanaPluginConstants.GROUP_NAME
            description = "Starts Qodana Inspections in a Docker container"

            projectDir.convention(project.provider {
                project.file(extension.projectPath)
            })
            resultsDir.convention(project.provider {
                project.file(extension.resultsPath)
            })
            cacheDir.convention(project.provider {
                project.file(extension.cachePath)
            })
            qodanaPath.convention(project.provider {
                project.file(extension.qodanaPath)
            })
            arguments.convention(listOf())
        }
    }
}
