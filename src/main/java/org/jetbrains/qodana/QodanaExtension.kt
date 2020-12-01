package org.jetbrains.qodana

open class QodanaExtension {
    var projectPath: String? = null
    var resultsPath: String? = null
    var profilePath: String? = null
    var disabledPluginsPath: String? = null
    val jvmParameters = ArrayList<String>()

    var dockerImageName: String? = null
    var dockerContainerName: String? = null
    val dockerPortBindings = HashMap<Int, Int>()
    val dockerVolumeBindings = HashMap<String, String>()
    val dockerEnvParameters = HashMap<String, String>()
    val dockerArguments = ArrayList<String>()
}