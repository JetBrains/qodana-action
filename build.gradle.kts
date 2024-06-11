fun properties(key: String) = providers.gradleProperty(key)
fun environment(key: String) = providers.environmentVariable(key)

plugins {
    `kotlin-dsl`
}

buildscript {
    repositories {
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

tasks {
    wrapper {
        gradleVersion = properties("gradleVersion").get()
    }
}
