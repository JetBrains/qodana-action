package org.jetbrains.qodana

import org.gradle.api.model.ObjectFactory
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional
import javax.inject.Inject

open class QodanaExtension @Inject constructor(objectFactory: ObjectFactory) {

    /**
     * Path to the project folder to inspect.
     * Default: current project path
     */
    @Input
    @Optional
    val projectPath: Property<String> = objectFactory.property(String::class.java)

    /**
     * Path to directory to store results of the task.
     * Default: `$projectPath/build/results`
     */
    @Input
    @Optional
    val resultsPath: Property<String> = objectFactory.property(String::class.java)

    /**
     * Path to cache directory.
     */
    @Input
    @Optional
    val cachePath: Property<String> = objectFactory.property(String::class.java)

    /**
     * Generate HTML report.
     * Disabled by default.
     */
    @Input
    @Optional
    val saveReport: Property<Boolean> = objectFactory.property(Boolean::class.java)

    /**
     * Serve an HTML report on [showReportPort] port.
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
}
