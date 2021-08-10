fun properties(key: String) = project.findProperty(key)?.toString()

plugins {
    id("org.jetbrains.kotlin.jvm") version "1.4.10"

    id("maven-publish")
    id("java-gradle-plugin")
    id("com.gradle.plugin-publish") version "0.12.0"
}

group = "org.jetbrains.qodana"
version = "0.1." + properties("buildNumber")

repositories {
    mavenCentral()
}

dependencies {
    implementation(gradleApi())
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8")

    testImplementation("org.junit.jupiter:junit-jupiter-api:5.6.0")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine")
}

tasks {
    test {
        useJUnitPlatform()
    }
}

gradlePlugin {
    plugins.create("qodana") {
        id = "org.jetbrains.qodana"
        displayName = "Gradle Qodana Plugin"
        implementationClass = "org.jetbrains.qodana.QodanaPlugin"
    }
}

pluginBundle {
    website = "https://github.com/JetBrains/gradle-qodana-plugin"
    vcsUrl = "https://github.com/JetBrains/gradle-qodana-plugin"

    description = "Gradle Qodana Plugin allows to run and configure Idea inspections for Gradle project."
    tags = listOf("qodana", "intellij", "idea", "inspections")

}
