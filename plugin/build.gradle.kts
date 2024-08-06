/*
 * Copyright 2021-2024 JetBrains s.r.o.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

@file:Suppress("UnstableApiUsage")

import org.jetbrains.dokka.gradle.DokkaTask

fun properties(key: String) = providers.gradleProperty(key)
fun environment(key: String) = providers.environmentVariable(key)

plugins {
    `kotlin-dsl`
    `maven-publish`
    alias(libs.plugins.pluginPublish)
    alias(libs.plugins.dokka)
}

group = properties("projectGroup").get()
version = "${properties("majorVersion").get()}.${properties("buildNumber").get()}"
description = properties("description").get()

repositories {
    mavenCentral()
}

dependencies {
    testImplementation(gradleTestKit())
    testImplementation(kotlin("test"))
    testImplementation(kotlin("test-junit"))
}

kotlin {
    jvmToolchain(8)
}

val dokkaHtml by tasks.getting(DokkaTask::class)

val javadocJar by tasks.registering(Jar::class) {
    dependsOn(dokkaHtml)
    archiveClassifier = "javadoc"
    from(dokkaHtml.outputDirectory)
}

val sourcesJar = tasks.register<Jar>("sourcesJar") {
    archiveClassifier = "sources"
    from(sourceSets.main.get().allSource)
}

tasks {
    test {
        val testGradleHome = layout.buildDirectory.asFile.get().resolve("testGradleHome")

        doFirst {
            testGradleHome.mkdir()
        }

        systemProperties["test.gradle.home"] = testGradleHome
        systemProperties["test.gradle.default"] = properties("gradleVersion").get()
        systemProperties["test.gradle.version"] = properties("testGradleVersion").get()
        systemProperties["test.gradle.arguments"] = properties("testGradleArguments").get()
        outputs.dir(testGradleHome)
    }
}

gradlePlugin {
    website = properties("website")
    vcsUrl = properties("vcsUrl")

    plugins.create("qodana") {
        id = properties("pluginId").get()
        displayName = properties("name").get()
        implementationClass = properties("pluginImplementationClass").get()
        description = project.description
        tags = properties("tags").map { it.split(',') }
    }
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
