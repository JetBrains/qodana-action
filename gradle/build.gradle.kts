import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

fun properties(key: String) = project.findProperty(key)?.toString()

plugins {
    `kotlin-dsl`
    `maven-publish`
    kotlin("jvm") version "1.6.10"
    id("com.gradle.plugin-publish") version "0.19.0"
}

group = "org.jetbrains.qodana"
version = "2023.2." + properties("buildNumber")

repositories {
    mavenCentral()
}

dependencies {
    testImplementation(gradleTestKit())
    testImplementation(kotlin("test"))
    testImplementation(kotlin("test-junit"))
}

tasks {
    withType<KotlinCompile> {
        kotlinOptions {
            jvmTarget = JavaVersion.VERSION_1_8.toString()
        }
    }

    test {
        configureTests(this)
    }

    wrapper {
        gradleVersion = properties("gradleVersion")
        distributionUrl = "https://cache-redirector.jetbrains.com/services.gradle.org/distributions/gradle-$gradleVersion-all.zip"
    }
}

fun configureTests(testTask: Test) {
    val testGradleHomePath = "$buildDir/testGradleHome"
    testTask.doFirst {
        File(testGradleHomePath).mkdir()
    }
    testTask.systemProperties["test.gradle.home"] = testGradleHomePath
    testTask.systemProperties["test.gradle.default"] = properties("gradleVersion")
    testTask.systemProperties["test.gradle.version"] = properties("testGradleVersion")
    testTask.systemProperties["test.gradle.arguments"] = properties("testGradleArguments")
    testTask.outputs.dir(testGradleHomePath)
}

gradlePlugin {
    plugins.create("qodana") {
        id = "org.jetbrains.qodana"
        displayName = "Qodana for Gradle"
        implementationClass = "org.jetbrains.qodana.QodanaPlugin"
    }
}

pluginBundle {
    website = "https://jetbrains.com/qodana"
    vcsUrl = "https://github.com/JetBrains/qodana-action"

    description = "Qodana for Gradle plugin allows to run and configure Qodana analysis for Gradle projects."
    tags = listOf("qodana", "intellij", "idea", "inspections")
}
