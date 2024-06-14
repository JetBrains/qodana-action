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

package org.jetbrains.qodana.tasks

import org.apache.tools.ant.util.TeeOutputStream
import org.gradle.api.GradleException
import org.gradle.api.provider.ListProperty
import org.gradle.api.tasks.*
import org.gradle.kotlin.dsl.property
import org.jetbrains.qodana.cli.Installer
import org.jetbrains.qodana.QodanaPluginConstants.QODANA_ENV
import org.jetbrains.qodana.QodanaPluginConstants.QODANA_ENV_NAME
import java.io.ByteArrayOutputStream
import java.io.File

@UntrackedTask(because = "Qodana tracks the state")  // TODO:
open class QodanaScanTask : Exec() {
    /**
     * Root directory of the project to be analyzed.
     */
    @InputDirectory
    @Optional
    val projectDir = objectFactory.property<File>()

    /**
     * Directory to store results of the task.
     */
    @OutputDirectory
    @Optional
    val resultsDir = objectFactory.property<File>()

    /**
     * Directory to store cache of the task.
     */
    @OutputDirectory
    @Optional
    val cacheDir = objectFactory.property<File>()
    
    /**
     * Executable of Qodana CLI path
     */
    @Input
    @Optional
    val qodanaPath = objectFactory.property<File>()

    /**
     * List of custom Qodana CLI `scan` arguments.
     */
    @Input
    @Optional
    val arguments: ListProperty<String> = objectFactory.listProperty(String::class.java)

    @TaskAction
    override fun exec() {
        setArgs(getArguments())
        executable = Installer().setup(qodanaPath.get())
        environment(QODANA_ENV, QODANA_ENV_NAME)

        ByteArrayOutputStream().use { os ->
            standardOutput = TeeOutputStream(System.out, os)

            runCatching {
                super.exec()
            }.exceptionOrNull()?.let {
                val message = os.toString().lines().find { line ->
                    line.startsWith("Inspection run is terminating")
                } ?: "Qodana finished with failure. Check logs and Qodana report for more details."

                throw TaskExecutionException(this, GradleException(message, it))
            }
        }
    }

    private fun getArguments(): List<String> {
        val args: MutableList<String> = mutableListOf(
            "scan",
            "--project-dir",
            projectDir.get().absolutePath,
            "--results-dir",
            resultsDir.get().absolutePath,
            "--cache-dir",
            cacheDir.get().absolutePath,
        )
        arguments.get().forEach {
            args.add(it)
        }
        return args
    }
}
