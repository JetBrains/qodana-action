package org.jetbrains.qodana

import org.gradle.api.model.ObjectFactory
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional
import org.gradle.kotlin.dsl.listProperty
import org.gradle.kotlin.dsl.property
import javax.inject.Inject

open class QodanaPluginExtension @Inject constructor(objectFactory: ObjectFactory) {
    /**
     * Path to the project folder to inspect.
     * Default: current project path
     */
    @Input
    @Optional
    val projectPath = objectFactory.property<String>()

    /**
     * Path to the directory to store results of the task.
     * Default: `$projectPath/build/results`
     */
    @Input
    @Optional
    val resultsPath = objectFactory.property<String>()


    /**
     * Path to the directory to store cache of the task.
     * Default: `$projectPath/build/cache`
     */
    @Input
    @Optional
    val cachePath = objectFactory.property<String>()

    /**
     * Path to the directory to store Qodana CLI.
     * Default: `$projectPath/build/qodana`
     */
    @Input
    @Optional
    val qodanaPath = objectFactory.property<String>()
}
