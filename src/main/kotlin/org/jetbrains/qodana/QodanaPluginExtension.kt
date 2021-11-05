package org.jetbrains.qodana

import org.gradle.api.model.ObjectFactory
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional
import org.gradle.kotlin.dsl.property
import javax.inject.Inject

open class QodanaPluginExtension @Inject constructor(objectFactory: ObjectFactory) {

    /**
     * Name of the Docker container to identify current container.
     */
    @Input
    @Optional
    val dockerContainerName = objectFactory.property<String>()

    /**
     * Docker image name.
     */
    @Input
    @Optional
    val dockerImageName = objectFactory.property<String>()

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
     * Path to the directory to store the generated report.
     * Default: `$projectPath/build/results/report`
     */
    @Input
    @Optional
    val reportPath = objectFactory.property<String>()

    /**
     * Run in baseline mode. Provide the path to an existing SARIF report to be used in the baseline state calculation.
     * See: https://www.jetbrains.com/help/qodana/qodana-intellij-docker-techs.html#Run+in+baseline+mode
     */
    @Input
    @Optional
    val baselinePath = objectFactory.property<String>()

    /**
     * Include in the output report the results from the baseline run that are absent in the current run.
     */
    @Input
    @Optional
    val baselineIncludeAbsent = objectFactory.property<Boolean>()

    /**
     * Path to the cache directory.
     */
    @Input
    @Optional
    val cachePath = objectFactory.property<String>()

    /**
     * Generate HTML report.
     * Disabled by default.
     */
    @Input
    @Optional
    val saveReport = objectFactory.property<Boolean>()

    /**
     * Serve an HTML report on [showReportPort] port.
     * Disabled by default.
     */
    @Input
    @Optional
    val showReport = objectFactory.property<Boolean>()

    /**
     * Default port used to show an HTML report.
     * Default: 8080
     *
     * @see [showReport]
     */
    @Input
    @Optional
    val showReportPort = objectFactory.property<Int>()

    /**
     * A number of problems that will serve as a quality gate. If this number is reached, the inspection run is terminated.
     */
    @Input
    @Optional
    val failThreshold = objectFactory.property<Int>()

    /**
     * Docker executable name.
     */
    @Input
    @Optional
    val executable = objectFactory.property<String>()

    /**
     * Automatically pull the latest Docker image before running the inspection.
     */
    @Input
    @Optional
    val autoUpdate = objectFactory.property<Boolean>()
}
