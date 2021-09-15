package org.jetbrains.qodana.tasks

import org.jetbrains.qodana.BaseTest
import org.jetbrains.qodana.QodanaPluginConstants
import org.jetbrains.qodana.QodanaPluginConstants.CLEAN_INSPECTIONS_TASK_NAME
import java.io.File
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CleanInspectionsTaskTest : BaseTest() {

    @Test
    fun `clean inspections`() {
        val resultsDir = File("$root/build/results").apply {
            mkdirs()
        }

        assertTrue {
            resultsDir.exists()
        }

        runTask(CLEAN_INSPECTIONS_TASK_NAME)

        assertFalse {
            resultsDir.exists()
        }
    }

    @Test
    fun `clean custom report folder`() {
        val reportDir = File("$root/build/report").apply {
            mkdirs()
        }

        assertTrue {
            reportDir.exists()
        }

        buildFile.groovy("""
            ${QodanaPluginConstants.EXTENSION_NAME} {
                reportPath = "${reportDir.canonicalPath}"
            }
        """)

        runTask(CLEAN_INSPECTIONS_TASK_NAME)

        assertFalse {
            reportDir.exists()
        }
    }

    @Test
    fun `task loads from the configuration cache`() {
        val resultsDir = File("$root/build/results").apply {
            mkdirs()
        }

        runTask(CLEAN_INSPECTIONS_TASK_NAME, "--configuration-cache")

        assertFalse {
            resultsDir.exists()
        }
        resultsDir.mkdirs()

        val result = runTask(CLEAN_INSPECTIONS_TASK_NAME, "--configuration-cache")

        assertTrue {
            result.output.contains("Reusing configuration cache.")
        }
        assertFalse {
            resultsDir.exists()
        }
    }
}
