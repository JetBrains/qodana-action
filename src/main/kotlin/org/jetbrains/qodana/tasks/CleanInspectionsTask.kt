package org.jetbrains.qodana.tasks

import org.gradle.api.model.ObjectFactory
import org.gradle.api.tasks.Delete
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.TaskAction
import org.gradle.kotlin.dsl.property
import javax.inject.Inject

open class CleanInspectionsTask @Inject constructor(
    objectFactory: ObjectFactory,
) : Delete() {

    @Input
    @Optional
    val resultsDir = objectFactory.property<String>()

    @Input
    @Optional
    val reportDir = objectFactory.property<String>()

    @TaskAction
    override fun clean() {
        delete(resultsDir.get())
        reportDir.orNull?.let {
            delete(it)
        }
        super.clean()
    }
}
