package org.jetbrains.qodana

import org.junit.Assume
import kotlin.test.Test
import kotlin.test.assertEquals

class QodanaPluginTest : BaseTest() {

    @Test
    fun `qodana-specific tasks`() {
        Assume.assumeFalse(Version.parse(gradleVersion) < Version.parse("6.9"))
        assertEquals(
            listOf(
                QodanaPluginConstants.CLEAN_INSPECTIONS_TASK_NAME,
                QodanaPluginConstants.RUN_INSPECTIONS_TASK_NAME,
                QodanaPluginConstants.STOP_INSPECTIONS_TASK_NAME,
                QodanaPluginConstants.UPDATE_INSPECTIONS_TASK_NAME,
            ),
            tasks(QodanaPluginConstants.GROUP_NAME),
        )
    }
}
