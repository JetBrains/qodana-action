package org.jetbrains.qodana

import org.gradle.api.internal.project.ProjectInternal
import org.gradle.testkit.runner.BuildResult
import org.gradle.testkit.runner.GradleRunner
import org.intellij.lang.annotations.Language
import java.io.File
import java.nio.file.Files.createTempDirectory
import kotlin.test.BeforeTest

open class BaseTest {

    private val gradleDefault = System.getProperty("test.gradle.default")
    private val gradleHome = System.getProperty("test.gradle.home")
    internal val gradleVersion = System.getProperty("test.gradle.version").takeIf(String::isNotEmpty) ?: gradleDefault

    val dir: File = createTempDirectory("tmp").toFile()
    val root = adjustWindowsPath(dir.canonicalPath)
    val buildFile = file("build.gradle")

    @BeforeTest
    fun setUp() {
        file("settings.gradle").groovy("rootProject.name = 'projectName'")

        buildFile.groovy("""
            plugins {
                id 'org.jetbrains.qodana'
            }

            repositories {
                mavenCentral()
            }
            
            qodana {
            }
        """)
    }

    private fun prepareTask(taskName: String, vararg arguments: String) =
        GradleRunner.create()
            .withProjectDir(dir)
            .withGradleVersion(gradleVersion)
            .forwardOutput()
            .withPluginClasspath()
            .withTestKitDir(File(gradleHome))
            .withArguments(taskName, "--console=plain", "--stacktrace", "--configuration-cache", *arguments)

    protected fun runTaskForCommand(taskName: String, vararg arguments: String) =
        prepareTask(taskName, *arguments).build().output.lines().run {
            get(indexOf("> Task :$taskName") + 1)
        }.run(::adjustWindowsPath)

    protected fun runTask(taskName: String, vararg arguments: String): BuildResult =
        prepareTask(taskName, *arguments).build()

    protected fun runFailingTask(taskName: String, vararg arguments: String): BuildResult =
        prepareTask(taskName, *arguments).buildAndFail()

    protected fun file(path: String) = path
        .run { takeIf { startsWith('/') } ?: "${dir.path}/$this" }
        .split('/')
        .run { File(dropLast(1).joinToString("/")) to last() }
        .apply { if (!first.exists()) first.mkdirs() }
        .run { File(first, second) }
        .apply { createNewFile() }

    fun tasks(groupName: String): List<String> = runTask(ProjectInternal.TASKS_TASK).output.lines().run {
        val start = indexOfFirst { it.equals("$groupName tasks", ignoreCase = true) } + 2
        drop(start).takeWhile(String::isNotEmpty).map { it.substringBefore(' ') }
    }

    fun adjustWindowsPath(s: String) = s.replace("\\", "/")

    // Methods can be simplified, when following tickets will be handled:
    // https://youtrack.jetbrains.com/issue/KT-24517
    // https://youtrack.jetbrains.com/issue/KTIJ-1001
    fun File.xml(@Language("XML") content: String) = append(content)

    fun File.groovy(@Language("Groovy") content: String) = append(content)

    fun File.java(@Language("Java") content: String) = append(content)

    fun File.kotlin(@Language("kotlin") content: String) = append(content)

    private fun File.append(content: String) = appendText(content.trimIndent() + "\n")
}
