package org.jetbrains.qodana

open class QodanaExtension {
    var projectPath: String? = null
    var resultsPath: String? = null
    var profilePath: String? = null
    var disabledPluginsPath: String? = null
    val jvmParameters = ArrayList<String>()

    var dockerImageName: String? = null
    var dockerContainerName: String? = null
    val dockerPortBindings = ArrayList<Pair<Int, Int>>()
    val dockerVolumeBindings = ArrayList<Pair<String, String>>()
    val dockerEnvParameters = HashMap<String, String>()
    val dockerArguments = ArrayList<String>()

    fun bind(outerPort: Int, dockerPort: Int) {
        dockerPortBindings.add(outerPort to dockerPort)
    }

    fun mount(outerPath: String, dockerPath: String) {
        dockerVolumeBindings.add(outerPath to dockerPath)
    }

    fun env(name: String, value: String) {
        dockerEnvParameters[name] = value
    }
}