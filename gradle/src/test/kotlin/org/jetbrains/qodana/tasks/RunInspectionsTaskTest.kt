package org.jetbrains.qodana.tasks

import org.jetbrains.qodana.BaseTest
import org.jetbrains.qodana.QodanaPluginConstants.DOCKER_CONTAINER_NAME_INSPECTIONS
import org.jetbrains.qodana.QodanaPluginConstants.DOCKER_IMAGE_NAME_INSPECTIONS
import org.jetbrains.qodana.QodanaPluginConstants.EXTENSION_NAME
import org.jetbrains.qodana.QodanaPluginConstants.RUN_INSPECTIONS_TASK_NAME
import org.jetbrains.qodana.QodanaPluginConstants.SHOW_REPORT_PORT
import org.jetbrains.qodana.QodanaPluginConstants.UPDATE_INSPECTIONS_TASK_NAME
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class RunInspectionsTaskTest : BaseTest() {

    @Test
    fun `run inspections with default parameters`() {
        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "--mount type=volume,dst=/data/project/.gradle " +
                DOCKER_IMAGE_NAME_INSPECTIONS,
            result
        )
    }

    @Test
    fun `run inspections with custom container and image names`() {
        buildFile.groovy("""
            qodana {
                dockerContainerName = "FOO"
                dockerImageName = "BAR"
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name FOO " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "--mount type=volume,dst=/data/project/.gradle " +
                "BAR",
            result
        )
    }

    @Test
    fun `run inspections with custom directories paths`() {
        val projectPath = File("$root/tmp/project").apply { mkdirs() }.canonicalPath.run(::adjustWindowsPath)
        val resultsPath = File("$root/tmp/results").apply { mkdirs() }.canonicalPath.run(::adjustWindowsPath)
        val cachePath = File("$root/tmp/cache").apply { mkdirs() }.canonicalPath.run(::adjustWindowsPath)
        val reportPath = File("$root/tmp/report").apply { mkdirs() }.canonicalPath.run(::adjustWindowsPath)

        buildFile.groovy("""
            qodana {
                projectPath = '$projectPath'
                resultsPath = '$resultsPath'
                cachePath = '$cachePath'
                reportPath = '$reportPath'
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-v $projectPath:/data/project " +
                "-v $resultsPath:/data/results " +
                "-v $reportPath:/data/results/report " +
                "-v $cachePath:/data/cache " +
                "--mount type=volume,dst=/data/project/.gradle " +
                DOCKER_IMAGE_NAME_INSPECTIONS,
            result
        )
    }

    @Test
    fun `run inspections with configured reporting`() {
        buildFile.groovy("""
            qodana {
                saveReport = true
                showReport = true
                showReportPort = 12345
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p 12345:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "--mount type=volume,dst=/data/project/.gradle " +
                "$DOCKER_IMAGE_NAME_INSPECTIONS " +
                "--save-report " +
                "--show-report",
            result
        )
    }

    @Test
    fun `run inspections with autoUpdate enabled`() {
        val result = runTask(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "> Task :$UPDATE_INSPECTIONS_TASK_NAME",
            result.output.lines().find {
                it.contains("> Task :$UPDATE_INSPECTIONS_TASK_NAME")
            }
        )
    }

    @Test
    fun `run inspections with autoUpdate disabled`() {
        buildFile.groovy("""
            qodana {
                autoUpdate = false
            }
        """)

        val result = runTask(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "> Task :$UPDATE_INSPECTIONS_TASK_NAME SKIPPED",
            result.output.lines().find {
                it.contains("> Task :$UPDATE_INSPECTIONS_TASK_NAME")
            }
        )

    }

    @Test
    fun `run inspections with custom profilePath`() {
        buildFile.groovy("""
            $RUN_INSPECTIONS_TASK_NAME {
                profilePath = "$root/foo.xml"
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "-v $root/foo.xml:/data/profile.xml " +
                "--mount type=volume,dst=/data/project/.gradle " +
                DOCKER_IMAGE_NAME_INSPECTIONS,
            result
        )
    }

    @Test
    fun `run inspections with custom disabledPluginsPath`() {
        buildFile.groovy("""
            $RUN_INSPECTIONS_TASK_NAME {
                disabledPluginsPath = "$root/foo.txt"
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "-v $root/foo.txt:/root/.config/idea/disabled_plugins.txt " +
                "--mount type=volume,dst=/data/project/.gradle " +
                DOCKER_IMAGE_NAME_INSPECTIONS,
            result
        )
    }

    @Test
    fun `run inspections with changes only inspecting enabled`() {
        buildFile.groovy("""
            $RUN_INSPECTIONS_TASK_NAME {
                changes = true
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "--mount type=volume,dst=/data/project/.gradle " +
                "$DOCKER_IMAGE_NAME_INSPECTIONS " +
                "-changes",
            result
        )
    }

    @Test
    fun `run inspections with 'bind' helper method called`() {
        buildFile.groovy("""
            $RUN_INSPECTIONS_TASK_NAME {
                bind(123, 456)
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-p 123:456 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "--mount type=volume,dst=/data/project/.gradle " +
                DOCKER_IMAGE_NAME_INSPECTIONS,
            result
        )
    }

    @Test
    fun `run inspections with 'mount' helper method called`() {
        val path = File("$root/tmp").apply { mkdirs() }.canonicalPath.run(::adjustWindowsPath)

        buildFile.groovy("""
            $RUN_INSPECTIONS_TASK_NAME {
                mount('$path', '/bar')
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "-v $path:/bar " +
                "--mount type=volume,dst=/data/project/.gradle " +
                DOCKER_IMAGE_NAME_INSPECTIONS,
            result
        )
    }

    @Test
    fun `run inspections with 'env' helper method called`() {
        buildFile.groovy("""
            $RUN_INSPECTIONS_TASK_NAME {
                env('FOO', 'bar')
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "-e FOO=bar " +
                "--mount type=volume,dst=/data/project/.gradle " +
                DOCKER_IMAGE_NAME_INSPECTIONS,
            result
        )
    }

    @Test
    fun `run inspections with 'dockerArg' helper method called`() {
        buildFile.groovy("""
            $RUN_INSPECTIONS_TASK_NAME {
                dockerArg('--foo')
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "--mount type=volume,dst=/data/project/.gradle " +
                "--foo " +
                DOCKER_IMAGE_NAME_INSPECTIONS,
            result
        )
    }

    @Test
    fun `run inspections with 'arg' helper method called`() {
        buildFile.groovy("""
            $RUN_INSPECTIONS_TASK_NAME {
                arg('--foo')
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "--mount type=volume,dst=/data/project/.gradle " +
                "$DOCKER_IMAGE_NAME_INSPECTIONS " +
                "--foo",
            result
        )
    }

    @Test
    fun `run inspections with custom baseline configuration`() {
        val baselinePath = File("$root/tmp/baseline").apply { mkdirs() }.canonicalPath.run(::adjustWindowsPath)

        buildFile.groovy("""
            $EXTENSION_NAME {
                baselinePath = '$baselinePath'
                baselineIncludeAbsent = true
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "--mount type=volume,dst=/data/project/.gradle " +
                "$DOCKER_IMAGE_NAME_INSPECTIONS " +
                "--baseline $baselinePath " +
                "--baseline-include-absent",
            result
        )
    }

    @Test
    fun `run inspections with custom failThreshold configuration`() {
        buildFile.groovy("""
            $EXTENSION_NAME {
                failThreshold = 123
            }
        """)

        val result = runTaskForCommand(RUN_INSPECTIONS_TASK_NAME)

        assertEquals(
            "run " +
                "--rm -e QODANA_ENV=gradle " +
                "--name $DOCKER_CONTAINER_NAME_INSPECTIONS " +
                "-p $SHOW_REPORT_PORT:8080 " +
                "-v $root:/data/project " +
                "-v $root/build/results:/data/results " +
                "--mount type=volume,dst=/data/project/.gradle " +
                "$DOCKER_IMAGE_NAME_INSPECTIONS " +
                "--fail-threshold 123",
            result
        )
    }

    @Test
    fun `task loads from the configuration cache`() {
        runTask(RUN_INSPECTIONS_TASK_NAME, "--configuration-cache")
        val result = runTask(RUN_INSPECTIONS_TASK_NAME, "--configuration-cache")

        assertTrue(result.output.contains("Reusing configuration cache."))
    }
}
