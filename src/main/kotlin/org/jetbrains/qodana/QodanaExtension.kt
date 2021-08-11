package org.jetbrains.qodana

import org.gradle.api.model.ObjectFactory
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional
import java.io.File
import javax.inject.Inject

open class QodanaExtension @Inject constructor(objectFactory: ObjectFactory) {

    @Input
    @Optional
    val projectPath: Property<String> = objectFactory.property(String::class.java)

    @Input
    @Optional
    val resultsPath: Property<String> = objectFactory.property(String::class.java)

    @Input
    @Optional
    val profilePath: Property<String> = objectFactory.property(String::class.java)

    @Input
    @Optional
    val disabledPluginsPath: Property<String> = objectFactory.property(String::class.java)

    @Input
    @Optional
    val jvmParameters: ListProperty<String> = objectFactory.listProperty(String::class.java)

    @Input
    @Optional
    val dockerImageName: Property<String> = objectFactory.property(String::class.java)

    @Input
    @Optional
    val dockerContainerName: Property<String> = objectFactory.property(String::class.java)

    @Input
    @Optional
    val dockerPortBindings: ListProperty<String> = objectFactory.listProperty(String::class.java)

    @Input
    @Optional
    val dockerVolumeBindings: ListProperty<String> = objectFactory.listProperty(String::class.java)

    @Input
    @Optional
    val dockerEnvParameters: ListProperty<String> = objectFactory.listProperty(String::class.java)

    @Input
    @Optional
    val dockerArguments: ListProperty<String> = objectFactory.listProperty(String::class.java)

    fun bind(outerPort: Int, dockerPort: Int) {
        dockerPortBindings.add("$outerPort:$dockerPort")
    }

    fun mount(outerPath: String, dockerPath: String) {
        dockerVolumeBindings.add("${File(outerPath).canonicalPath}:$dockerPath")
    }

    fun env(name: String, value: String) {
        dockerEnvParameters.add("$name=$value")
    }
}
