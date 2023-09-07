package org.jetbrains.qodana.tasks

import org.jetbrains.qodana.BaseTest
import org.jetbrains.qodana.QodanaPluginConstants.DOCKER_CONTAINER_NAME_INSPECTIONS
import org.jetbrains.qodana.QodanaPluginConstants.STOP_INSPECTIONS_TASK_NAME
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class StopInspectionsTaskTest : BaseTest() {

    @Test
    fun `stop inspections`() {
        val result = runTaskForCommand(STOP_INSPECTIONS_TASK_NAME)

        assertEquals(
            "stop " +
                DOCKER_CONTAINER_NAME_INSPECTIONS,
            result
        )
    }

    @Test
    fun `task loads from the configuration cache`() {
        runTask(STOP_INSPECTIONS_TASK_NAME, "--configuration-cache")
        val result = runTask(STOP_INSPECTIONS_TASK_NAME, "--configuration-cache")

        assertTrue(result.output.contains("Reusing configuration cache."))
    }
}
