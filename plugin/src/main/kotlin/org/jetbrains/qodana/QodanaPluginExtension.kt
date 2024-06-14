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

package org.jetbrains.qodana

import org.gradle.api.model.ObjectFactory
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional
import org.gradle.kotlin.dsl.property
import javax.inject.Inject

open class QodanaPluginExtension @Inject constructor(objectFactory: ObjectFactory) {
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
     * Path to the directory to store cache of the task.
     * Default: `$projectPath/build/cache`
     */
    @Input
    @Optional
    val cachePath = objectFactory.property<String>()

    /**
     * Path to the directory to store Qodana CLI.
     * Default: `$projectPath/build/qodana`
     */
    @Input
    @Optional
    val qodanaPath = objectFactory.property<String>()
}
