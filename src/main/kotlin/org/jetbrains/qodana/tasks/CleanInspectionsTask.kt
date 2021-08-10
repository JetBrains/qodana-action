package org.jetbrains.qodana.tasks

import org.gradle.api.model.ObjectFactory
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Delete
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import javax.inject.Inject

open class CleanInspectionsTask @Inject constructor(
    objectFactory: ObjectFactory,
) : Delete() {

    @Input
    val resultsPath: Property<String> = objectFactory.property(String::class.java)

    @TaskAction
    override fun clean() {
        delete(resultsPath.get())
        super.clean()
    }
}
