package org.jetbrains.qodana

object QodanaPluginConstants {
    const val GROUP_NAME = "qodana"
    const val EXTENSION_NAME = "qodana"

    const val RUN_INSPECTIONS_TASK_NAME = "runInspections"
    const val STOP_INSPECTIONS_TASK_NAME = "stopInspections"
    const val CLEAN_INSPECTIONS_TASK_NAME = "cleanInspections"

    const val RUN_CLONE_FINDER_TASK_NAME = "runCloneFinder"
    const val STOP_CLONE_FINDER_TASK_NAME = "stopCloneFinder"
    const val CLEAN_CLONE_FINDER_TASK_NAME = "cleanCloneFinder"

    const val RUN_LICENSE_AUDIT_TASK_NAME = "runLicenseAudit"
    const val STOP_LICENSE_AUDIT_TASK_NAME = "stopLicenseAudit"
    const val CLEAN_LICENSE_AUDIT_TASK_NAME = "cleanLicenseAudit"

    const val DOCKER_CONTAINER_NAME_INSPECTIONS = "idea-inspections"
    const val DOCKER_CONTAINER_NAME_CLONE_FINDER = "clone-finder"
    const val DOCKER_CONTAINER_NAME_LICENSE_AUDIT = "license-audit"
    const val DOCKER_IMAGE_NAME_INSPECTIONS = "jetbrains/qodana:latest"
    const val DOCKER_IMAGE_NAME_CLONE_FINDER = "jetbrains/qodana-clone-finder:latest"
    const val DOCKER_IMAGE_NAME_LICENSE_AUDIT = "jetbrains/qodana-license-audit:latest"
}

