/*
 * Copyright 2021-2025 JetBrains s.r.o.
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

package org.jetbrains.qodana.maven

import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugin.MojoFailureException
import org.apache.maven.plugins.annotations.Mojo
import org.apache.maven.plugins.annotations.Parameter
import org.jetbrains.qodana.Installer
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader

/**
 * Runs Qodana static code analysis on the project.
 *
 * Example usage:
 * ```
 * mvn qodana:scan
 * mvn qodana:scan -Dqodana.arguments="--fail-threshold,0"
 * ```
 */
@Mojo(name = "scan", requiresProject = true)
class QodanaScanMojo : AbstractMojo() {

    private val currentPath = System.getenv("PATH")
    private val currentHome = System.getenv("HOME")

    /**
     * Root directory of the project to be analyzed.
     */
    @Parameter(defaultValue = "\${project.basedir}", property = "qodana.projectDir")
    lateinit var projectDir: File

    /**
     * Directory to store results of the analysis.
     */
    @Parameter(defaultValue = "\${project.build.directory}/qodana/results", property = "qodana.resultsDir")
    lateinit var resultsDir: File

    /**
     * Directory to store cache.
     */
    @Parameter(defaultValue = "\${project.build.directory}/qodana/cache", property = "qodana.cacheDir")
    lateinit var cacheDir: File

    /**
     * Directory where Qodana CLI binary will be stored.
     */
    @Parameter(defaultValue = "\${project.build.directory}/qodana", property = "qodana.qodanaDir")
    lateinit var qodanaDir: File

    /**
     * List of custom Qodana CLI `scan` arguments.
     * Can be specified as comma-separated values via -Dqodana.arguments="--arg1,value1,--arg2,value2"
     */
    @Parameter(property = "qodana.arguments")
    var arguments: List<String> = emptyList()

    /**
     * Use a nightly version of Qodana CLI.
     */
    @Parameter(defaultValue = "false", property = "qodana.useNightly")
    var useNightly: Boolean = false

    override fun execute() {
        val version = if (useNightly) "nightly" else Installer.getLatestVersion()
        val qodanaExecutable = File(qodanaDir, "qodana${Installer.getExtension()}")

        log.info("Setting up Qodana CLI (version: $version)...")
        val executablePath = Installer().setup(qodanaExecutable, version)

        val command = buildCommand(executablePath)
        log.info("Running: ${command.joinToString(" ")}")

        val processBuilder = ProcessBuilder(command)
            .directory(projectDir)
            .redirectErrorStream(true)

        processBuilder.environment()[QodanaMavenConstants.QODANA_ENV] = QodanaMavenConstants.QODANA_ENV_NAME
        currentPath?.let { processBuilder.environment()["PATH"] = it }
        currentHome?.let { processBuilder.environment()["HOME"] = it }

        val process = processBuilder.start()
        val output = StringBuilder()

        BufferedReader(InputStreamReader(process.inputStream)).use { reader ->
            reader.lineSequence().forEach { line ->
                log.info(line)
                output.appendLine(line)
            }
        }

        val exitCode = process.waitFor()

        if (exitCode != 0) {
            val message = output.lines().find { line ->
                line.startsWith("Inspection run is terminating")
            } ?: "Qodana finished with failure (exit code: $exitCode). Check logs and Qodana report for more details."

            throw MojoFailureException(message)
        }

        log.info("Qodana analysis completed successfully.")
        log.info("Results are available at: ${resultsDir.absolutePath}")
    }

    private fun buildCommand(executablePath: String): List<String> {
        val command = mutableListOf(
            executablePath,
            "scan",
            "--project-dir", projectDir.absolutePath,
            "--results-dir", resultsDir.absolutePath,
            "--cache-dir", cacheDir.absolutePath
        )
        command.addAll(arguments)
        return command
    }
}
