/*
 * Copyright 2021-2024 JetBrains s.r.o.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.jetbrains.qodana

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
        private const val LATEST_VERSION = "v2024.3.5"
        private const val RELEASE_DOWNLOAD_URL =
            "https://github.com/JetBrains/qodana-cli/releases/download/%s/qodana_%s_%s"

        fun getQodanaUrl(
            platform: String = getPlatformName(),
            arch: String = getArchName(),
            version: String = LATEST_VERSION
        ): String {
            return String.format(RELEASE_DOWNLOAD_URL, version, platform, arch) + getExtension()
        }

        fun getExtension(): String = if (getPlatformName() == "windows") ".exe" else ""

        fun getLatestVersion(): String = LATEST_VERSION

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

        fun getChecksum(version: String = getLatestVersion()): String {
            val platform = getPlatformName()
            val arch = getArchName()
            return CHECKSUMS[version.removePrefix("v")]?.get("${platform}_${arch}")
                ?: throw IllegalArgumentException("Unsupported combination of version, platform and architecture: $version ${platform}_${arch}")
        }
    }

    fun setup(
        path: File,
        version: String = getLatestVersion(),
    ): String {
        val downloadURL = getQodanaUrl(version = version)
        val useNightly = version == "nightly"

        if (path.exists()) {
            try {
                if (!useNightly) verifyChecksum(path, getChecksum(version))
                return path.absolutePath
            } catch (e: IOException) {
                log.warning("Checksum verification failed. Redownloading the binary.")
            }
            path.delete()
        }

        try {
            download(downloadURL, path)
            if (!useNightly) verifyChecksum(path, getChecksum(version))
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
