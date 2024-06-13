fun properties(key: String) = providers.gradleProperty(key)
fun environment(key: String) = providers.environmentVariable(key)

plugins {
    `maven-publish`
    `kotlin-dsl`
    `java-library`
}

val kotlinVersion by extra(libs.versions.kotlin.get())

group = "org.jetbrains.qodana.common"
version = "${properties("majorVersion").get()}.${properties("buildNumber").get()}"
kotlin {
    jvmToolchain(8)
    version = "2024.1.6"
}
publishing {
    publications {
        create<MavenPublication>("common") {
            groupId = group.toString()
            artifactId = "cli"
            version = version.toString()
            from(components["java"])
            pom {
                url.set("https://github.com/JetBrains/qodana-action")
                licenses {
                    license {
                        name.set("Apache-2.0")
                        url.set("https://github.com/JetBrains/qodana-action/blob/main/LICENSE")
                    }
                }
            }
        }
    }
    repositories {
        maven {
            url = uri("https://packages.jetbrains.team/maven/p/sa/maven-public")
            credentials {
                username = System.getenv("JB_SPACE_INTELLIJ_CLIENT_ID")
                password = System.getenv("JB_SPACE_INTELLIJ_CLIENT_SECRET")
            }
        }
    }
}