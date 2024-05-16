package org.jetbrains.qodana


import org.gradle.api.GradleException
import org.gradle.api.logging.Logger
import java.io.*
import java.net.URL
import java.nio.channels.Channels
import java.nio.file.Files
import java.nio.file.attribute.PosixFilePermission


@Suppress("MemberVisibilityCanBePrivate")
class Installer {
    val log: Logger = org.gradle.api.logging.Logging.getLogger(Installer::class.java)
    companion object {
        private const val VERSION = "2024.1.5"
        private const val RELEASE_DOWNLOAD_URL = "https://github.com/JetBrains/qodana-cli/releases/download/v%s/qodana_%s_%s"

        fun getQodanaUrl(platform: String = getPlatformName(), arch: String = getArchName(), version: String = VERSION): String {
            return String.format(RELEASE_DOWNLOAD_URL, version, platform, arch) + getExtension()
        }

        fun getExtension(): String = if (getPlatformName() == "windows") ".exe" else ""

        fun getVersion(): String = VERSION

        fun getArchName(): String {
            val arch = System.getProperty("os.arch").lowercase()
            return when {
                arch.contains("x86_64") || arch.contains("amd64") -> "x86_64"
                arch.contains("arm64") || arch.contains("aarch64") -> "arm64"
                else -> throw IllegalArgumentException("Unsupported architecture: $arch")
            }
        }

        fun getPlatformName(): String {
            val systemName = System.getProperty("os.name").lowercase()
            return when {
                systemName.contains("windows") -> "windows"
                systemName.contains("mac os x") || systemName.contains("darwin") || systemName.contains("osx") -> "darwin"
                systemName.contains("linux") || systemName.contains("freebsd") -> "linux"
                else -> throw IllegalArgumentException("Unsupported OS: $systemName")
            }
        }
    }

    fun setup(path: File, downloadURL: String = getQodanaUrl()): String {
        if (path.exists()) {
            return path.absolutePath
        } else try {
            download(downloadURL, path)
        } catch (e: IOException) {
            throw GradleException("Unable to download latest qodana binary", e)
        }

        return path.absolutePath
    }

    private fun download(url: String, executablePath: File) {
        executablePath.parentFile.mkdirs()
        log.lifecycle("Downloading: {} to {}", url, executablePath)
        val website = URL(url)
        Channels.newChannel(website.openStream()).use { rbc ->
            FileOutputStream(executablePath).use { fos ->
                fos.channel.transferFrom(rbc, 0, Long.MAX_VALUE)
                setFilePermissions(executablePath)
            }
        }
    }

    private fun setFilePermissions(file: File) {
        if (getPlatformName() == "windows") {
            return
        }
        log.debug("Setting file permissions")
        val perms: MutableSet<PosixFilePermission> = HashSet()
        perms.add(PosixFilePermission.OWNER_READ)
        perms.add(PosixFilePermission.OWNER_WRITE)
        perms.add(PosixFilePermission.OWNER_EXECUTE)
        perms.add(PosixFilePermission.GROUP_EXECUTE)
        perms.add(PosixFilePermission.OTHERS_EXECUTE)
        Files.setPosixFilePermissions(file.toPath(), perms)
    }
}