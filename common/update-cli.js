const fs = require("fs");
const http = require("http");
const https = require("https");
const {createHash} = require("crypto");
const {readFileSync} = require("fs");
const {execSync} = require("child_process");
const path = require("path");
const cliJsonPath = "./cli.json";
const checksumsKtPath = "../plugin/src/main/kotlin/org/jetbrains/qodana/Checksums.kt";

const PLATFORMS = ["windows", "linux", "darwin"];
const ARCHS = ["x86_64", "arm64"];

function sha256sum(file) {
    const hash = createHash("sha256");
    hash.update(readFileSync(file));
    return hash.digest("hex");
}

function downloadFile(url, destinationPath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith("https") ? https : http;

        protocol.get(url, response => {
            if (response.statusCode === 200) {
                const file = fs.createWriteStream(destinationPath);
                response.pipe(file);
                file.on("finish", () => {
                    file.close(resolve);
                });
            } else if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                downloadFile(response.headers.location, destinationPath)
                    .then(resolve)
                    .catch(reject);
            } else {
                reject(new Error(`Failed to download file. Status code: ${response.statusCode}`));
            }
        }).on("error", err => {
            fs.unlink(destinationPath, () => {
            });
            reject(err);
        });
    });
}

function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                if (res.statusCode >= 200 && res.statusCode <= 299) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Request failed with status code ${res.statusCode}`));
                }
            });
        });

        req.on("error", (error) => {
            reject(error);
        });

        req.end();
    });
}

async function getLatestRelease() {
    try {
        const options = {
            hostname: "api.github.com",
            path: `/repos/jetbrains/qodana-cli/releases/latest`,
            headers: {
                "User-Agent": "request",
                "Accept": "application/vnd.github.v3+json"
            }
        };

        const release = await makeRequest(options);
        return release.tag_name.substring(1);
    } catch (error) {
        console.error("An error occurred:", error);
    }
}

function updateCliChecksums(latestVersion, checksumsPath, cliJsonPath) {
    const cliJson = JSON.parse(fs.readFileSync(cliJsonPath, "utf-8"));
    const allowedKeysfromCliJson = ["windows_x86_64", "windows_arm64", "linux_x86_64", "linux_arm64", "darwin_x86_64", "darwin_arm64"];
    const checksums = fs.readFileSync(checksumsPath, "utf-8");
    checksums.split("\n").forEach(line => {
        const [checksum, filename] = line.trim().split("  ");

        if (checksum && filename) {
            const key = filename.split("_").slice(1).join("_").split(".")[0];
            if (allowedKeysfromCliJson.includes(key)) {
                cliJson.checksum[key] = checksum;
            }
        }
    });
    cliJson.version = latestVersion;
    fs.writeFileSync(cliJsonPath, JSON.stringify(cliJson, null, 2));
    fs.unlinkSync(checksumsPath);
}

function updateCircleCIChecksums(circleCIConfigPath) {
    let circleCIConfig = fs.readFileSync(circleCIConfigPath, "utf-8");
    execSync("curl -fSsL https://github.com/jetbrains/qodana-cli/releases/latest/download/qodana_linux_x86_64.tar.gz -o qodana_linux_x86_64.tar.gz");
    execSync("mkdir qodana && tar -xzf qodana_linux_x86_64.tar.gz -C qodana");
    const checksum = sha256sum("qodana/qodana");
    const circleCIConfigLines = circleCIConfig.split("\n");
    circleCIConfigLines[55] = `        QODANA_SHA_256=${checksum}`;
    circleCIConfig = circleCIConfigLines.join("\n");
    fs.writeFileSync(circleCIConfigPath, circleCIConfig);
    execSync("rm -rf qodana/ qodana_linux_x86_64.tar.gz");
}

function updateChecksumsKtFile(checksums, latestVersion) {
    let checksumsKtContent = fs.readFileSync(checksumsKtPath, "utf-8");

    const newChecksums = `    "${latestVersion}" to mapOf(\n` +
        checksums.map(({platform, arch, checksum}) => `        "${platform}_${arch}" to "${checksum}"`).join(",\n") +
        "\n    )";

    const checksumSectionRegex = /val CHECKSUMS = mapOf\((.|\n)*?\)/;
    const match = checksumSectionRegex.exec(checksumsKtContent);

    if (match) {
        const updatedContent = match[0].replace(")", `,\n${newChecksums}\n)`);
        checksumsKtContent = checksumsKtContent.replace(checksumSectionRegex, updatedContent);
    } else {
        const newContent = `val CHECKSUMS = mapOf(\n${newChecksums}\n)`;
        checksumsKtContent = checksumsKtContent.replace("val CHECKSUMS = mapOf()", newContent);
    }

    fs.writeFileSync(checksumsKtPath, checksumsKtContent);
}

function updateVersions(latestVersion, currentVersion) {
    const latestVersions = latestVersion.split(".");
    const latestMajor = parseInt(latestVersions[0]);
    const latestMinor = parseInt(latestVersions[1]);
    const latestPatch = parseInt(latestVersions[2]);

    let taskJson = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, "..", "vsts", "QodanaScan", "task.json"),
            "utf8"
        )
    );
    taskJson.version.Major = latestMajor;
    taskJson.version.Minor = latestMinor;
    taskJson.version.Patch = latestPatch;
    fs.writeFileSync(
        path.join(__dirname, "..", "vsts", "QodanaScan", "task.json"),
        JSON.stringify(taskJson, null, 2)
    );
    const currentVersions = currentVersion.split(".");
    const currentMajor = parseInt(currentVersions[0]);
    const currentMinor = parseInt(currentVersions[1]);
    const currentPatch = parseInt(currentVersions[2]);

    replaceStringsInProject(`${latestMajor}.${latestMinor}.${latestPatch}`, `${currentMajor}.${currentMinor}.${currentPatch}`);
    replaceStringsInProject(`${latestMajor}.${latestMinor}`, `${currentMajor}.${currentMinor}`);
    replaceStringsInProject(`${latestMajor}`, `${currentMajor}`);
}

function replaceStringsInProject(newString, oldString) {
    process.env.LC_ALL = "C";
    const isMacOS = process.platform === "darwin";
    const command = `cd .. && find . -type f -not -path "./common/src/main/kotlin/org/jetbrains/qodana/cli/Checksums.kt" -exec sed -i${isMacOS ? " ''" : ""} 's/${oldString}/${newString}/g' {} +`;
    console.log("Running command:", command);
    execSync(command, {shell: "/bin/bash"});
}

async function main() {
    try {
        const currentVersion = JSON.parse(fs.readFileSync(cliJsonPath, "utf-8")).version;
        console.log("Current version:", currentVersion);
        const latestVersion = await getLatestRelease();
        console.log("Latest version:", latestVersion);
        console.log("Downloading new checksums...");
        await downloadFile(`https://github.com/jetbrains/qodana-cli/releases/latest/download/checksums.txt`, "checksums.txt");
        updateVersions(latestVersion, currentVersion);
        updateCliChecksums(latestVersion, "checksums.txt", cliJsonPath);
        updateCircleCIChecksums("../orb/commands/scan.yml");

        // Download binaries, calculate checksums, and update Checksums.kt
        const checksums = [];
        for (const platform of PLATFORMS) {
            for (const arch of ARCHS) {
                const url = `https://github.com/jetbrains/qodana-cli/releases/latest/download/qodana_${platform}_${arch}${platform === "windows" ? ".exe" : ""}`;
                const filePath = path.join(__dirname, `qodana_${platform}_${arch}${platform === "windows" ? ".exe" : ""}`);
                console.log(`Downloading ${url}...`);
                await downloadFile(url, filePath);
                const checksum = sha256sum(filePath);
                checksums.push({platform, arch, checksum});
                fs.unlinkSync(filePath);
            }
        }
        updateChecksumsKtFile(checksums, latestVersion);

        console.log("Checksums updated successfully");
    } catch (error) {
        console.error(error);
    }
}

main();
