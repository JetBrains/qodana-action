package org.jetbrains.qodana.tasks

import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.TaskAction
import org.gradle.kotlin.dsl.property

open class StopInspectionsTask : Exec() {

    @Input
    val dockerContainerName = objectFactory.property<String>()

    /**
     * Docker executable.
     */
    @Input
    @Optional
    val dockerExecutable = objectFactory.property<String>()

    @TaskAction
    override fun exec() {
        setArgs(getArguments())
        executable = dockerExecutable.get()
        super.exec()
    }

    private fun getArguments() = listOf("stop", dockerContainerName.get())
}
