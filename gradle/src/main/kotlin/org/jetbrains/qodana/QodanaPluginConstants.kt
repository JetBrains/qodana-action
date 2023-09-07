package org.jetbrains.qodana

object QodanaPluginConstants {
    const val GROUP_NAME = "qodana"
    const val EXTENSION_NAME = "qodana"
    const val EXECUTABLE = "docker"
    const val SHOW_REPORT_PORT = 8080

    const val RUN_INSPECTIONS_TASK_NAME = "runInspections"
    const val STOP_INSPECTIONS_TASK_NAME = "stopInspections"
    const val UPDATE_INSPECTIONS_TASK_NAME = "updateInspections"
    const val CLEAN_INSPECTIONS_TASK_NAME = "cleanInspections"

    const val QODANA_ENV_NAME = "gradle"
    const val DOCKER_CONTAINER_NAME_INSPECTIONS = "idea-inspections"
    const val DOCKER_IMAGE_NAME_INSPECTIONS = "jetbrains/qodana-jvm-community:latest"
}

