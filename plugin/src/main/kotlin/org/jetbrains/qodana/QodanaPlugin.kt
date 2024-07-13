/*
 * Copyright 2021-2024 JetBrains s.r.o.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
        val extension =
            project.extensions.create(QodanaPluginConstants.EXTENSION_NAME, QodanaPluginExtension::class.java)
                .also { ext ->
                    ext.projectPath.convention(project.projectDir.canonicalPath)
                    ext.resultsPath.convention(project.provider {
                        "${ext.projectPath.get()}/build/qodana/results"
                    })
                    ext.cachePath.convention(project.provider {
                        "${ext.projectPath.get()}/build/qodana/cache"
                    })
                    ext.qodanaPath.convention(project.provider {
                        "${ext.projectPath.get()}/build/qodana/${Installer.getLatestVersion()}/qodana${Installer.getExtension()}"
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
            useNightly.convention(false)
        }
    }
}
