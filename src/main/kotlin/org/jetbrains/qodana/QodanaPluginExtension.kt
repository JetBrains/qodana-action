package org.jetbrains.qodana

import org.gradle.api.model.ObjectFactory
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional
import javax.inject.Inject

open class QodanaPluginExtension @Inject constructor(objectFactory: ObjectFactory) {

    /**
     * Name of the Docker container to identify current container.
     */
    @Input
    @Optional
    val dockerContainerName: Property<String> = objectFactory.property(String::class.java)

    /**
     * Docker image name.
     */
    @Input
    @Optional
    val dockerImageName: Property<String> = objectFactory.property(String::class.java)

    /**
     * Path to the project folder to inspect.
     * Default: current project path
     */
    @Input
    @Optional
    val projectPath: Property<String> = objectFactory.property(String::class.java)

    /**
     * Path to the directory to store results of the task.
     * Default: `$projectPath/build/results`
     */
    @Input
    @Optional
    val resultsPath: Property<String> = objectFactory.property(String::class.java)

    /**
     * Path to the directory to store the generated report.
     * Default: `$projectPath/build/results/report`
     */
    @Input
    @Optional
    val reportPath: Property<String> = objectFactory.property(String::class.java)

    /**
     * Run in baseline mode. Provide the path to an existing SARIF report to be used in the baseline state calculation.
     * See: https://www.jetbrains.com/help/qodana/qodana-intellij-docker-techs.html#Run+in+baseline+mode
     */
    @Input
    @Optional
    val baselinePath: Property<String> = objectFactory.property(String::class.java)

    /**
     * Include in the output report the results from the baseline run that are absent in the current run.
     */
    @Input
    @Optional
    val baselineIncludeAbsent: Property<Boolean> = objectFactory.property(Boolean::class.java)

    /**
     * Path to the cache directory.
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

    /**
     * A number of problems that will serve as a quality gate. If this number is reached, the inspection run is terminated.
     */
    @Input
    @Optional
    val failThreshold: Property<Int> = objectFactory.property(Int::class.java)

    /**
     * Docker executable name.
     */
    @Input
    @Optional
    val executable: Property<String> = objectFactory.property(String::class.java)

    /**
     * Automatically pull the latest Docker image before running the inspection.
     */
    @Input
    @Optional
    val autoUpdate: Property<Boolean> = objectFactory.property(Boolean::class.java)
}
