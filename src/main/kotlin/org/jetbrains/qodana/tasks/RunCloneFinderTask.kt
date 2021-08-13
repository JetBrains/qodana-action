package org.jetbrains.qodana.tasks

import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.Optional
import java.io.File

open class RunCloneFinderTask : RunTask() {

    /**
     * Reference projects to compare the queried project with.
     */
    @InputDirectory
    val versusDir: Property<File> = objectFactory.property(File::class.java)

    /**
     * One or more languages to search clones in.
     */
    @Input
    @Optional
    val language: ListProperty<String> = objectFactory.listProperty(String::class.java)

}
