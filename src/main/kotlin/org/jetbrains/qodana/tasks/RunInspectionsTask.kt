package org.jetbrains.qodana.tasks

import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.TaskAction

open class RunInspectionsTask : Exec() {

    @Input
    @Optional
    val dockerContainerName: Property<String> = objectFactory.property(String::class.java)

    @Input
    @Optional
    val dockerImageName: Property<String> = objectFactory.property(String::class.java)

    @Input
    @Optional
    val dockerPortBindings: ListProperty<String> = objectFactory.listProperty(String::class.java)

    @Input
    @Optional
    val dockerVolumeBindings: ListProperty<String> = objectFactory.listProperty(String::class.java)

    @Input
    @Optional
    val dockerEnvParameters: ListProperty<String> = objectFactory.listProperty(String::class.java)

    @Input
    @Optional
    val dockerArguments: ListProperty<String> = objectFactory.listProperty(String::class.java)

    init {
        executable = "docker"
    }

    @TaskAction
    override fun exec() {
        args = getArguments()
        super.exec()
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

        return args
    }
}
