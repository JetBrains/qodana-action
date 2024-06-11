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
                QodanaPluginConstants.QODANA_SCAN_TASK_NAME,
            ),
            tasks(QodanaPluginConstants.GROUP_NAME),
        )
    }
}
