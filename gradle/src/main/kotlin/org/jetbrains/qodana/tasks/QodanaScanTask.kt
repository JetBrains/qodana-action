package org.jetbrains.qodana.tasks

import org.apache.tools.ant.util.TeeOutputStream
import org.gradle.api.GradleException
import org.gradle.api.provider.ListProperty
import org.gradle.api.tasks.*
import org.gradle.kotlin.dsl.property
import org.jetbrains.qodana.Installer
import org.jetbrains.qodana.QodanaPluginConstants
import java.io.ByteArrayOutputStream
import java.io.File

@Suppress("MemberVisibilityCanBePrivate")
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
//        val gradleBuildProjectDir = System.getProperty("user.dir")
//        val destinationFolder = File("$gradleBuildProjectDir/build/qodana")
//        destinationFolder.mkdirs()
//        val executable = File("${destinationFolder.absolutePath}/qodana")
        
        // get current project directory by default
        
        
        executable = Installer().setup(qodanaPath.get())

        ByteArrayOutputStream().use { os ->
            standardOutput = TeeOutputStream(System.out, os)

            runCatching {
                super.exec()
            }.exceptionOrNull()?.let {
                val message = os.toString().lines().find { line ->
                    line.startsWith("Inspection run is terminating")
                } ?: "Qodana inspection finished with failure. Check logs and Qodana report for more details."

                throw TaskExecutionException(this, GradleException(message, it))
            }
        }
    }

    private fun getArguments(): List<String> {
        val args: MutableList<String> = mutableListOf(
            "scan",
            "-e",
            "QODANA_ENV=${QodanaPluginConstants.QODANA_ENV_NAME}",
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
