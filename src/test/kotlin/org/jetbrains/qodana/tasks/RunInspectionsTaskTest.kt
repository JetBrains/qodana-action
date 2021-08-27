package org.jetbrains.qodana.tasks

import org.jetbrains.qodana.BaseTest
import org.jetbrains.qodana.QodanaPluginConstants.DOCKER_CONTAINER_NAME_INSPECTIONS
import org.jetbrains.qodana.QodanaPluginConstants.DOCKER_IMAGE_NAME_INSPECTIONS
import org.jetbrains.qodana.QodanaPluginConstants.RUN_INSPECTIONS_TASK_NAME
import kotlin.test.Test
import kotlin.test.assertEquals

class RunInspectionsTaskTest : BaseTest() {

    @Test
    fun `returns change notes for the version specified with extension`() {
        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--label org.jetbrains.analysis=inspection " +
                "--rm " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p 8080:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "--mount type=volume,dst=/data/project/.gradle " +
                DOCKER_IMAGE_NAME_INSPECTIONS,
            result
        )
    }
}
