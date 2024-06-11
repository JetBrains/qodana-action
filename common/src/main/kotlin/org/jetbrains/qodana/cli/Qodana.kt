package org.jetbrains.qodana.cli

import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.net.URL
import java.nio.channels.Channels
import java.nio.file.Files
import java.nio.file.attribute.PosixFilePermission
import java.security.MessageDigest
import java.util.logging.Logger

@Suppress("MemberVisibilityCanBePrivate")
class Installer {
    val log: Logger = Logger.getLogger(Installer::class.java.name)
    companion object {
        private const val VERSION = "2024.1.6"
        private const val RELEASE_DOWNLOAD_URL = "https://github.com/JetBrains/qodana-cli/releases/download/v%s/qodana_%s_%s"
        private val CHECKSUMS = mapOf(
            "windows_x86_64" to "cba8236cc8c650ecac61d543e744cb20e4763a26a075f37dc5909880de93b1f3",
            "windows_arm64" to "b0547cd008959ca275d0a945e9ae025c4c9271cffa0e87ffaac883d164bf84e2",
            "linux_x86_64" to "597d870f4c747d04d0280956306e2e7b9e003662d4600d93c1b69fcaffc2bb7b",
            "linux_arm64" to "b127fc5fe46f5c197781ff0f30de4e4f68b3ba19c5748dcb87c3d1417a3d9f89",
            "darwin_x86_64" to "847495bdeb8bffd2e13b0af8decdbd3b7b23735ad18746d0629e7a5e25c867de",
            "darwin_arm64" to "e87ff91a64b8c77466938ee2020bf8636b46016ff9b587aa3fcaa356d6de6b72"
        )

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

        fun getChecksum(): String {
            val platform = getPlatformName()
            val arch = getArchName()
            return CHECKSUMS["${platform}_${arch}"]
                ?: throw IllegalArgumentException("Unsupported combination of platform and architecture: ${platform}_${arch}")
        }
    }

    fun setup(path: File, downloadURL: String = getQodanaUrl()): String {
        if (path.exists()) {
            return path.absolutePath
        } else try {
            download(downloadURL, path)
            verifyChecksum(path, getChecksum())
        } catch (e: IOException) {
            throw IOException("Unable to download latest qodana binary", e)
        }

        return path.absolutePath
    }

    private fun download(url: String, executablePath: File) {
        executablePath.parentFile.mkdirs()
        log.info("Downloading: $url to $executablePath")
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
        val perms: MutableSet<PosixFilePermission> = HashSet()
        perms.add(PosixFilePermission.OWNER_READ)
        perms.add(PosixFilePermission.OWNER_WRITE)
        perms.add(PosixFilePermission.OWNER_EXECUTE)
        perms.add(PosixFilePermission.GROUP_EXECUTE)
        perms.add(PosixFilePermission.OTHERS_EXECUTE)
        Files.setPosixFilePermissions(file.toPath(), perms)
    }

    private fun verifyChecksum(file: File, expectedChecksum: String) {
        val checksum = calculateChecksum(file)
        if (checksum != expectedChecksum) {
            throw IOException("Checksum verification failed. Expected: $expectedChecksum, but got: $checksum")
        }
    }

    private fun calculateChecksum(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { fis ->
            val byteArray = ByteArray(1024)
            var bytesCount: Int

            while (fis.read(byteArray).also { bytesCount = it } != -1) {
                digest.update(byteArray, 0, bytesCount)
            }
        }

        val bytes = digest.digest()
        val sb = StringBuilder()
        for (byte in bytes) {
            sb.append(String.format("%02x", byte))
        }
        return sb.toString()
    }
}
