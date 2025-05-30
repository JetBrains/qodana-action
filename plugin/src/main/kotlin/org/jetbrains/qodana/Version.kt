/*
 * Copyright 2021-2025 JetBrains s.r.o.
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

class Version(
    private val major: Int = 0,
    private val minor: Int = 0,
    private val patch: Int = 0,
    private val version: String = "",
) : Comparable<Version> {

    companion object {
        fun parse(versionString: String) =
            versionString.split(' ', '.', '-', '"', '_')
                .mapNotNull(String::toIntOrNull)
                .let { it + List(3) { 0 } }
                .let { (major, minor, patch) -> Version(major, minor, patch, versionString) }
    }

    private inline fun Int.or(other: () -> Int) = takeIf { this != 0 } ?: other()

    override fun compareTo(other: Version) =
        (major - other.major)
            .or { minor - other.minor }
            .or { patch - other.patch }
            .or { version.compareTo(other.version, ignoreCase = true) }

    override fun toString() = version.takeIf(String::isNotEmpty) ?: "$major.$minor.$patch"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as Version

        if (major != other.major) return false
        if (minor != other.minor) return false
        if (patch != other.patch) return false
        if (!toString().equals(other.toString(), ignoreCase = true)) return false

        return true
    }

    override fun hashCode(): Int {
        var result = major
        result = 31 * result + minor
        result = 31 * result + patch
        result = 31 * result + version.hashCode()
        return result
    }
}
