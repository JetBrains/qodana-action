package org.jetbrains.qodana.tasks

import org.gradle.api.provider.Property
import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

open class StopTask : Exec() {

    @Input
    val dockerContainerName: Property<String> = objectFactory.property(String::class.java)

    init {
        executable = "docker"
    }

    @TaskAction
    override fun exec() {
        args = getArguments()
        super.exec()
    }

    private fun getArguments() = listOf("stop", dockerContainerName.get())
}
