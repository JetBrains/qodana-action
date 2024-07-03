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
    version = "2024.1.7"
}

tasks.register<Jar>("jarSources") {
    archiveClassifier.set("sources")
    from(sourceSets.main.get().allSource)
}
