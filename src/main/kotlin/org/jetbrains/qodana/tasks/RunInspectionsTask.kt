package org.jetbrains.qodana.tasks

import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional

open class RunInspectionsTask : RunTask() {

    /**
     * List of JVM parameters to be passed to the IntelliJ instance via the `IDE_PROPERTIES_PROPERTY` environment variable.
     */
    @Input
    @Optional
    val jvmParameters: ListProperty<String> = objectFactory.listProperty(String::class.java)

    /**
     * Path to the profile file to be mounted as `/data/profile.xml`.
     * See [Order of resolving a profile](https://www.jetbrains.com/help/qodana/qodana-intellij-docker-techs.html#Order+of+resolving+a+profile).
     */
    @Input
    @Optional
    val profilePath: Property<String> = objectFactory.property(String::class.java)

    /**
     * Path to the list of plugins to be disabled in the Qodana IDE instance to be mounted as `/root/.config/idea/disabled_plugins.txt`
     */
    @Input
    @Optional
    val disabledPluginsPath: Property<String> = objectFactory.property(String::class.java)

    /**
     * Inspect uncommitted changes and report new problems.
     * Disabled by default.
     */
    @Input
    @Optional
    val changes: Property<Boolean> = objectFactory.property(Boolean::class.java)
}
