const fs = require('fs');
const http = require('http');
const https = require('https');
const { createHash } = require("crypto");
const { readFileSync } = require("fs");
const { execSync } = require("child_process");

const url = 'https://github.com/jetbrains/qodana-cli/releases/latest/download/checksums.txt';
const cliJsonPath = './cli.json';

function sha256sum(file) {
  const hash = createHash('sha256')
  hash.update(readFileSync(file))
  return hash.digest('hex')
}

function downloadFile(url, destinationPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, response => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(destinationPath);
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destinationPath)
          .then(resolve)
          .catch(reject);
      } else {
        reject(new Error(`Failed to download file. Status code: ${response.statusCode}`));
      }
    }).on('error', err => {
      fs.unlink(destinationPath, () => {});
      reject(err);
    });
  });
}

function updateCliChecksums(checksumsPath, cliJsonPath) {
  const cliJson = JSON.parse(fs.readFileSync(cliJsonPath, 'utf-8'));
  const allowedKeysfromCliJson = ['windows_x86_64', 'windows_arm64', 'linux_x86_64', 'linux_arm64', 'darwin_x86_64', 'darwin_arm64'];
  const checksums = fs.readFileSync(checksumsPath, 'utf-8');
  checksums.split('\n').forEach(line => {
    const [checksum, filename] = line.trim().split('  ');

    if (checksum && filename) {
      const key = filename.split('_').slice(1).join('_').split('.')[0];
      if (allowedKeysfromCliJson.includes(key)) {
        cliJson.checksum[key] = checksum;
      }
    }
  });
  fs.writeFileSync(cliJsonPath, JSON.stringify(cliJson, null, 2));
  fs.unlinkSync(checksumsPath);
}

function updateCircleCIChecksums(circleCIConfigPath) {
  let circleCIConfig = fs.readFileSync(circleCIConfigPath, 'utf-8');
  execSync('curl -fSsL https://github.com/jetbrains/qodana-cli/releases/latest/download/qodana_linux_x86_64.tar.gz -o qodana_linux_x86_64.tar.gz');
  execSync('mkdir qodana && tar -xzf qodana_linux_x86_64.tar.gz -C qodana');
  const checksum = sha256sum('qodana/qodana');
  const circleCIConfigLines = circleCIConfig.split('\n');
  circleCIConfigLines[55] = `        QODANA_SHA_256=${checksum}`;
  circleCIConfig = circleCIConfigLines.join('\n');
  fs.writeFileSync(circleCIConfigPath, circleCIConfig);
  execSync('rm -rf qodana/ qodana_linux_x86_64.tar.gz');
}

async function main() {
  try {
    await downloadFile(url, 'checksums.txt');
    updateCliChecksums('checksums.txt', cliJsonPath);
    updateCircleCIChecksums('../src/commands/scan.yml');
    console.log('Checksums updated successfully!');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Run the script
main();
