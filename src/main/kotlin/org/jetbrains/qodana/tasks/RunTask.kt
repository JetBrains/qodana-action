package org.jetbrains.qodana.tasks

import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.TaskAction
import java.io.File

open class RunTask : Exec() {

    /**
     * Root directory of the project to be analyzed.
     */
    @InputDirectory
    @Optional
    val projectDir: Property<File> = objectFactory.property(File::class.java)

    /**
     * Directory to store results of the task.
     */
    @OutputDirectory
    @Optional
    val resultsDir: Property<File> = objectFactory.property(File::class.java)

    /**
     * Task cache directory.
     */
    @OutputDirectory
    @Optional
    val cacheDir: Property<File> = objectFactory.property(File::class.java)

    /**
     * Generate an HTML report.
     * Disabled by default.
     */
    @Input
    @Optional
    val saveReport: Property<Boolean> = objectFactory.property(Boolean::class.java)

    /**
     * Serve an HTML report on port 8080.
     * Disabled by default.
     */
    @Input
    @Optional
    val showReport: Property<Boolean> = objectFactory.property(Boolean::class.java)

    /**
     * Default port used to show an HTML report.
     * Default: 8080
     *
     * @see [showReport]
     */
    @Input
    @Optional
    val showReportPort: Property<Int> = objectFactory.property(Int::class.java)

    /**
     * Name of the Docker container to identify current container.
     */
    @Input
    @Optional
    val dockerContainerName: Property<String> = objectFactory.property(String::class.java)

    /**
     * Docker image name.
     */
    @Input
    @Optional
    val dockerImageName: Property<String> = objectFactory.property(String::class.java)

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

    init {
        executable = "docker"
    }

    @TaskAction
    override fun exec() {
        args = getArguments()
        super.exec()
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
            "--label", "org.jetbrains.analysis=inspection",
            "--rm",
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
