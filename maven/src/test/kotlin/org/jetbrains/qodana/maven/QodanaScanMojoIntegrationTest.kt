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

package io.github.qodana.maven

import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.test.assertTrue

/**
 * Integration tests for the Qodana Maven plugin.
 * These tests require the plugin to be installed in the local Maven repository.
 * Run `mvn install -DskipTests` before running these tests.
 */
class QodanaScanMojoIntegrationTest {

    @TempDir
    lateinit var tempDir: File

    private lateinit var projectDir: File

    @BeforeEach
    fun setUp() {
        projectDir = tempDir

        // Create pom.xml
        File(projectDir, "pom.xml").writeText("""
            <?xml version="1.0" encoding="UTF-8"?>
            <project xmlns="http://maven.apache.org/POM/4.0.0"
                     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                     xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
                <modelVersion>4.0.0</modelVersion>
                <groupId>com.example</groupId>
                <artifactId>test-project</artifactId>
                <version>1.0-SNAPSHOT</version>
                <properties>
                    <maven.compiler.source>11</maven.compiler.source>
                    <maven.compiler.target>11</maven.compiler.target>
                </properties>
                <build>
                    <plugins>
                        <plugin>
                            <groupId>io.github.qodana</groupId>
                            <artifactId>qodana-maven-plugin</artifactId>
                            <version>2025.3.1</version>
                        </plugin>
                    </plugins>
                </build>
            </project>
        """.trimIndent())

        // Create source directory
        val srcDir = File(projectDir, "src/main/java/com/example")
        srcDir.mkdirs()

        // Check if plugin is installed in local repo
        val m2Repo = File(System.getProperty("user.home"), ".m2/repository")
        val pluginDir = File(m2Repo, "io/github/qodana/qodana-maven-plugin/2025.3.1")
        assumeTrue(pluginDir.exists(), "Plugin not installed. Run 'mvn install -DskipTests' first.")
    }

    @Test
    fun `run qodana with help argument`() {
        val result = runMaven("qodana:scan", "-Dqodana.arguments=-h")
        assertTrue(
            result.output.contains("Usage") ||
            result.output.contains("qodana") ||
            result.output.contains("scan") ||
            result.output.contains("help"),
            "Expected help output, got: ${result.output}"
        )
    }

    @Test
    fun `run qodana in a container in a non-empty directory and fail with threshold`() {
        val githubActions = "true".equals(System.getenv("GITHUB_ACTIONS"), ignoreCase = true)
        val isLinux = System.getProperty("os.name").contains("Linux")
        if (githubActions) {
            assumeTrue(isLinux, "Docker tests only run on Linux in GitHub Actions")
        }

        // Create a Python file with issues (extra blank lines)
        File(projectDir, "main.py").writeText("print('Hello, world!')\n\n\n\n\n\nprint()")
        File(projectDir, "qodana.yaml").writeText("linter: jetbrains/qodana-python-community")

        val result = runMaven(
            "qodana:scan",
            "-Dqodana.arguments=--fail-threshold,0,--property=idea.headless.enable.statistics=false",
            expectFailure = true
        )

        assertTrue(
            result.output.contains("The number of problems exceeds") ||
            result.output.contains("BUILD FAILURE") ||
            result.output.contains("Qodana finished with failure"),
            "Expected failure due to threshold exceeded, got: ${result.output}"
        )
    }

    data class MavenResult(val exitCode: Int, val output: String)

    private fun runMaven(vararg args: String, expectFailure: Boolean = false): MavenResult {
        val mvnExecutable = if (System.getProperty("os.name").lowercase().contains("windows")) {
            "mvn.cmd"
        } else {
            "mvn"
        }

        val command = listOf(mvnExecutable) + args.toList()

        val process = ProcessBuilder(command)
            .directory(projectDir)
            .redirectErrorStream(true)
            .start()

        val output = process.inputStream.bufferedReader().readText()
        val completed = process.waitFor(10, TimeUnit.MINUTES)

        if (!completed) {
            process.destroyForcibly()
            throw RuntimeException("Maven process timed out")
        }

        val exitCode = process.exitValue()
        if (exitCode != 0 && !expectFailure) {
            throw RuntimeException("Maven failed with exit code $exitCode: $output")
        }

        return MavenResult(exitCode, output)
    }
}
