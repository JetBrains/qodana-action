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
                QodanaPluginConstants.CLEAN_CLONE_FINDER_TASK_NAME,
                QodanaPluginConstants.CLEAN_INSPECTIONS_TASK_NAME,
                QodanaPluginConstants.CLEAN_LICENSE_AUDIT_TASK_NAME,
                QodanaPluginConstants.RUN_CLONE_FINDER_TASK_NAME,
                QodanaPluginConstants.RUN_INSPECTIONS_TASK_NAME,
                QodanaPluginConstants.RUN_LICENSE_AUDIT_TASK_NAME,
                QodanaPluginConstants.STOP_CLONE_FINDER_TASK_NAME,
                QodanaPluginConstants.STOP_INSPECTIONS_TASK_NAME,
                QodanaPluginConstants.STOP_LICENSE_AUDIT_TASK_NAME,
            ),
            tasks(QodanaPluginConstants.GROUP_NAME),
        )
    }
}
