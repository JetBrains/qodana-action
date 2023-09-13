package org.jetbrains.qodana.tasks

import org.jetbrains.qodana.BaseTest
import org.jetbrains.qodana.QodanaPluginConstants.EXTENSION_NAME
import org.jetbrains.qodana.QodanaPluginConstants.QODANA_SCAN_TASK_NAME
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
        val notLinux = !System.getProperty("os.name").contains("Linux")

        if (githubActions && notLinux) {
            buildFile.groovy("""
            $EXTENSION_NAME {
            }
            $QODANA_SCAN_TASK_NAME {
                 arguments = ["--ide", "QDPYC"]  // "--property=idea.headless.enable.statistics=false"]
            }
        """)
        } else {
            buildFile.groovy("""
            $EXTENSION_NAME {
            }
            $QODANA_SCAN_TASK_NAME {
                 arguments = ["--fail-threshold", "0", "--property=idea.headless.enable.statistics=false"]
            }
        """)
        }
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
