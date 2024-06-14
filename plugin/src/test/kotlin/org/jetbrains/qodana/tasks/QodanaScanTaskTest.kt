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

package org.jetbrains.qodana.tasks

import org.jetbrains.qodana.BaseTest
import org.jetbrains.qodana.QodanaPluginConstants.EXTENSION_NAME
import org.jetbrains.qodana.QodanaPluginConstants.QODANA_SCAN_TASK_NAME
import org.junit.Assume
import kotlin.test.Test
import kotlin.test.assertTrue

class QodanaScanTaskTest : BaseTest() {

    @Test
    fun `run qodana with empty configuration in an empty directory`() {
        buildFile.groovy("""
            $EXTENSION_NAME {
            }
        """)
        try {
            runTaskForCommand(QODANA_SCAN_TASK_NAME)
        } catch (e: Exception) {
            assertTrue(e.message!!.contains("https://www.jetbrains.com/help/qodana/supported-technologies.html"))
        }
    }

    @Test
    fun `run qodana in a non-empty directory and fail with threshold`() {
        val githubActions = "true".equals(System.getenv("GITHUB_ACTIONS"), ignoreCase = true)
        val isLinux = System.getProperty("os.name").contains("Linux")
        if (githubActions) {
            Assume.assumeTrue(isLinux)
        }
        buildFile.groovy("""
            $EXTENSION_NAME {
            }
            $QODANA_SCAN_TASK_NAME {
                 arguments = ["--fail-threshold", "0", "--property=idea.headless.enable.statistics=false"]
            }
        """.trimIndent())
        file("main.py").writeText("print('Hello, world!')\n\n\n\n\n\nprint()")
        file("qodana.yaml").writeText("linter: jetbrains/qodana-python-community")
        try {
            runTaskForCommand(QODANA_SCAN_TASK_NAME)
        } catch (e: Exception) {
            assertTrue(e.message!!.contains("The number of problems exceeds"))
        }
    }

    @Test
    fun `task loads from the configuration cache`() {
        buildFile.groovy("""
            $EXTENSION_NAME {
            }
            $QODANA_SCAN_TASK_NAME {
                 arguments = ["-h"]
            }
        """.trimIndent())
        runTask(QODANA_SCAN_TASK_NAME, "--configuration-cache")
        val result = runTask(QODANA_SCAN_TASK_NAME, "--configuration-cache")
        assertTrue(result.output.contains("Reusing configuration cache."))
    }
}
