package org.jetbrains.qodana.tasks

import org.apache.tools.ant.util.TeeOutputStream
import org.gradle.api.GradleException
import org.gradle.api.provider.ListProperty
import org.gradle.api.tasks.*
import org.gradle.kotlin.dsl.property
import org.jetbrains.qodana.QodanaPluginConstants
import java.io.ByteArrayOutputStream
import java.io.File

@Suppress("MemberVisibilityCanBePrivate")
open class RunInspectionsTask : Exec() {

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
     * Directory to store the generated report.
     */
    @OutputDirectory
    @Optional
    val reportDir = objectFactory.property<File>()

    /**
     * Task cache directory.
     */
    @OutputDirectory
    @Optional
    val cacheDir = objectFactory.property<File>()

    /**
     * Generate an HTML report.
     * Disabled by default.
     */
    @Input
    @Optional
    val saveReport = objectFactory.property<Boolean>()

    /**
     * Serve an HTML report on port 8080.
     * Disabled by default.
     */
    @Input
    @Optional
    val showReport = objectFactory.property<Boolean>()

    /**
     * Default port used to show an HTML report.
     * Default: 8080
     *
     * @see [showReport]
     */
    @Input
    @Optional
    val showReportPort = objectFactory.property<Int>()

    /**
     * Name of the Docker container to identify current container.
     */
    @Input
    @Optional
    val dockerContainerName = objectFactory.property<String>()

    /**
     * Docker image name.
     */
    @Input
    @Optional
    val dockerImageName = objectFactory.property<String>()

    /**
     * List of port bindings in `OUTER_PORT:DOCKER_PORT` format.
     *
     * @see [bind] method
     */
    @Input
    @Optional
    val dockerPortBindings: ListProperty<String> = objectFactory.listProperty(String::class.java)

    /**
     * List of volumes to mount in `OUTER_PATH:DOCKER_PATH` format.
     *
     * @see [mount] method
     */
    @Input
    @Optional
    val dockerVolumeBindings: ListProperty<String> = objectFactory.listProperty(String::class.java)

    /**
     * List of environment variables to provide to Docker in `NAME=VALUE` format.
     *
     * @see [env] method
     */
    @Input
    @Optional
    val dockerEnvParameters: ListProperty<String> = objectFactory.listProperty(String::class.java)

    /**
     * List of custom Docker arguments to start Qodana container.
     *
     * @see [dockerArg] method
     */
    @Input
    @Optional
    val dockerArguments: ListProperty<String> = objectFactory.listProperty(String::class.java)

    /**
     * List of custom Qodana container arguments.
     *
     * @see [arg] method
     */
    @Input
    @Optional
    val arguments: ListProperty<String> = objectFactory.listProperty(String::class.java)

    /**
     * Docker executable.
     */
    @Input
    @Optional
    val dockerExecutable = objectFactory.property<String>()

    /**
     * List of JVM parameters to be passed to the IntelliJ instance via the `IDE_PROPERTIES_PROPERTY` environment variable.
     */
    @Input
    @Optional
    val jvmParameters: ListProperty<String> = objectFactory.listProperty(String::class.java)

    /**
     * Path to the profile file to be mounted as `/data/profile.xml`.
     * See [Order of resolving a profile](https://www.jetbrains.com/help/qodana/qodana-intellij-docker-techs.html#Order+of+resolving+a+profile).
     */
    @Input
    @Optional
    val profilePath = objectFactory.property<String>()

    /**
     * Path to the list of plugins to be disabled in the Qodana IDE instance to be mounted as `/root/.config/idea/disabled_plugins.txt`
     */
    @Input
    @Optional
    val disabledPluginsPath = objectFactory.property<String>()

    /**
     * Inspect uncommitted changes and report new problems.
     * Disabled by default.
     */
    @Input
    @Optional
    val changes = objectFactory.property<Boolean>()

    /**
     * Run in baseline mode. Provide the path to an existing SARIF report to be used in the baseline state calculation.
     * See: https://www.jetbrains.com/help/qodana/qodana-intellij-docker-techs.html#Run+in+baseline+mode
     */
    @Input
    @Optional
    val baselineDir = objectFactory.property<File>()

    /**
     * Include in the output report the results from the baseline run that are absent in the current run.
     */
    @Input
    @Optional
    val baselineIncludeAbsent = objectFactory.property<Boolean>()

    /**
     * A number of problems that will serve as a quality gate. If this number is reached, the inspection run is terminated.
     */
    @Input
    @Optional
    val failThreshold = objectFactory.property<Int>()

    @TaskAction
    override fun exec() {
        setArgs(getArguments())
        executable = dockerExecutable.get()

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

    fun bind(outerPort: Int, dockerPort: Int) {
        dockerPortBindings.add("$outerPort:$dockerPort")
    }

    fun mount(outerPath: String, dockerPath: String) {
        dockerVolumeBindings.add("${File(outerPath).canonicalPath}:$dockerPath")
    }

    fun env(name: String, value: String) {
        dockerEnvParameters.add("$name=$value")
    }

    fun dockerArg(argument: String) {
        dockerArguments.add(argument)
    }

    fun arg(argument: String) {
        arguments.add(argument)
    }

    private fun getArguments(): List<String> {
        val args = mutableListOf(
            "run",
            "--rm",
            "-e QODANA_ENV=${QodanaPluginConstants.QODANA_ENV_NAME}",
            "--name", dockerContainerName.get(),
        )

        dockerPortBindings.get().forEach {
            args.add("-p")
            args.add(it)
        }
        dockerVolumeBindings.get().forEach {
            args.add("-v")
            args.add(it)
        }
        dockerEnvParameters.get().forEach {
            args.add("-e")
            args.add(it)
        }

        args.add("--mount")
        args.add("type=volume,dst=/data/project/.gradle")

        dockerArguments.get().forEach {
            args.add(it)
        }

        args.add(dockerImageName.get())

        arguments.get().forEach {
            args.add(it)
        }

        return args
    }
}
