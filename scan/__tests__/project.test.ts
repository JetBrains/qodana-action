import {expect, test} from '@jest/globals'
import {
  sha256sum,
  getQodanaSha256,
  getQodanaUrl,
  VERSION,
  SUPPORTED_PLATFORMS,
  SUPPORTED_ARCHS
} from '../../common/qodana'
import * as fs from 'fs'

import path = require('path')

import * as os from 'os'
import * as https from 'https'

test('check whether action README.md has the latest version mentioned everywhere', () => {
  const readmeMd = fs.readFileSync(
    path.join(__dirname, '..', '..', 'README.md'),
    'utf8'
  )
  const mentions =
    readmeMd.match(/uses: JetBrains\/qodana-action@v\d+\.\d+\.\d+/g) || []
  expect(mentions.length > 0).toEqual(true)
  for (const mention of mentions) {
    expect(mention).toEqual(`uses: JetBrains/qodana-action@v${VERSION}`)
  }
})

test('check whether Azure Pipelines task.json definitions is up to date', () => {
  const taskJson = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', '..', 'vsts', 'QodanaScan', 'task.json'),
      'utf8'
    )
  )
  expect(
    `${taskJson.version.Major}.${taskJson.version.Minor}.${taskJson.version.Patch}`
  ).toEqual(VERSION)
})

test('check whether Azure Pipelines README.md has the latest major version mentioned', () => {
  const readmeMd = fs.readFileSync(
    path.join(__dirname, '..', '..', 'vsts', 'README.md'),
    'utf8'
  )
  const mentions = readmeMd.match(/ - task: QodanaScan@\d+/g) || []
  expect(mentions.length > 0).toEqual(true)
  for (const mention of mentions) {
    expect(mention).toEqual(` - task: QodanaScan@${VERSION.split('.')[0]}`)
  }
})

test('check whether CircleCI orb definition contains the latest version', () => {
  const orb = path.join(__dirname, '..', '..', 'src', 'commands', 'scan.yml')
  const example = path.join(
    __dirname,
    '..',
    '..',
    'src',
    'examples',
    'scan.yml'
  )
  for (const orbFile of [orb, example]) {
    const orbFileContent = fs.readFileSync(orbFile, 'utf8')
    const mentions = orbFileContent.match(/\d+\.\d+\.\d+/g) || []
    expect(mentions.length > 0).toEqual(true)
    for (const mention of mentions) {
      expect(mention).toEqual(VERSION)
    }
  }
})

test('download all Qodana CLI archives and check their checksums', async () => {
  for (const arch of SUPPORTED_ARCHS) {
    for (const platform of SUPPORTED_PLATFORMS) {
      const url = getQodanaUrl(arch, platform)
      const archiveName = `${platform}_${arch}`
      const temp = path.join(os.tmpdir(), archiveName)
      await downloadFile(url, temp)
      const expectedSha256 = getQodanaSha256(arch, platform)
      const actualSha256 = sha256sum(temp)
      expect(`${archiveName}: ${actualSha256}`).toEqual(
        `${archiveName}: ${expectedSha256}`
      )
      fs.rmSync(temp, {force: true})
    }
  }
})

function downloadFile(url: string, dest: string) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const download = (url: string) => {
      https
        .get(url, response => {
          switch (response.statusCode) {
            case 200:
              response.pipe(file)
              file.on('finish', () => {
                file.close(resolve)
              })
              break
            case 301:
            case 302:
            case 303:
            case 307:
            case 308:
              if (response.headers.location !== undefined) {
                download(response.headers.location)
              }
              break
            default:
              reject(
                new Error(
                  `Server responded with ${response.statusCode}: ${response.statusMessage}`
                )
              )
          }
        })
        .on('error', err => {
          fs.unlinkSync(dest)
          reject(err)
        })
    }
    download(url)
  })
}
