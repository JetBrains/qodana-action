package org.jetbrains.qodana.tasks

import org.gradle.api.provider.Property
import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.TaskAction

open class UpdateInspectionsTask : Exec() {

    @Input
    val dockerImageName: Property<String> = objectFactory.property(String::class.java)

    /**
     * Docker executable.
     */
    @Input
    @Optional
    val dockerExecutable: Property<String> = objectFactory.property(String::class.java)

    @TaskAction
    override fun exec() {
        args = getArguments()
        executable = dockerExecutable.get()
        super.exec()
    }

    private fun getArguments() = listOf("pull", dockerImageName.get())
}
