rootProject.name = "qodana"

pluginManagement {
    repositories {
        google()
        gradlePluginPortal()
        mavenCentral()
    }
}

include(
    ":plugin",
    ":common",
)