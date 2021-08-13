package org.jetbrains.qodana.tasks

import org.gradle.api.model.ObjectFactory
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Delete
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.TaskAction
import java.io.File
import javax.inject.Inject

open class CleanTask : Delete() {

    @InputDirectory
    @Optional
    @Suppress("LeakingThis")
    val resultsDir: Property<File> = getObjectFactory().property(File::class.java)

    @Inject
    open fun getObjectFactory(): ObjectFactory {
        throw UnsupportedOperationException()
    }

    @TaskAction
    override fun clean() {
        delete(resultsDir.get())
        super.clean()
    }
}
