package org.jetbrains.qodana.tasks

import org.jetbrains.qodana.BaseTest
import org.jetbrains.qodana.QodanaPluginConstants.DOCKER_IMAGE_NAME_INSPECTIONS
import org.jetbrains.qodana.QodanaPluginConstants.UPDATE_INSPECTIONS_TASK_NAME
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class UpdateInspectionsTaskTest : BaseTest() {

    @Test
    fun `update inspections`() {
        val result = runTaskForCommand(UPDATE_INSPECTIONS_TASK_NAME)

        assertEquals(
            "pull " +
                DOCKER_IMAGE_NAME_INSPECTIONS,
            result
        )
    }

    @Test
    fun `task loads from the configuration cache`() {
        runTask(UPDATE_INSPECTIONS_TASK_NAME, "--configuration-cache")
        val result = runTask(UPDATE_INSPECTIONS_TASK_NAME, "--configuration-cache")

        assertTrue(result.output.contains("Reusing configuration cache."))
    }
}
