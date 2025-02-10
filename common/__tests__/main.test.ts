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

import {expect, test} from '@jest/globals'
import {getCoverageFromSarif, QODANA_OPEN_IN_IDE_NAME, QODANA_REPORT_URL_NAME} from "../qodana";
import {
  getCoverageStats,
  getReportURL
} from "../output";
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

test('test passed coverage output', () => {
  const result = getCoverageStats(
    getCoverageFromSarif('__tests__/data/some.sarif.json')
  )
  expect(result).toEqual(passedCoverageFixture())
})

test('test failed coverage output', () => {
  const result = getCoverageStats(
    getCoverageFromSarif('__tests__/data/empty.sarif.json')
  )
  expect(result).toEqual(failedCoverageFixture())
})

describe('getReportURL', () => {
  let tempDir: string

  beforeEach(async () => {
    // create a unique temporary directory for each test
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jest-'))
  })

  afterEach(async () => {
    // cleanup - remove temporary directory
    await fs.promises.rm(tempDir, {recursive: true})
  })

  it('returns cloud URL if open in IDE file exists', async () => {
    const url = 'http://cloud.url'
    const data = {cloud: {url}}
    const filepath = path.join(tempDir, QODANA_OPEN_IN_IDE_NAME)
    await fs.promises.writeFile(filepath, JSON.stringify(data))
    console.log(JSON.stringify(data))

    const result = getReportURL(tempDir)

    expect(result).toBe(url)
  })

  it('returns report URL if open in IDE file does not exist but report file exists', async () => {
    const url = 'http://report.url'
    const filepath = path.join(tempDir, QODANA_REPORT_URL_NAME)
    await fs.promises.writeFile(filepath, url)

    const result = getReportURL(tempDir)

    expect(result).toBe(url)
  })

  it('returns empty string if no file exists', () => {
    const result = getReportURL(tempDir)

    expect(result).toBe('')
  })

  it('returns empty string if open in IDE file exists but does not contain url', async () => {
    const data = {cloud: {}}
    const filepath = path.join(tempDir, QODANA_OPEN_IN_IDE_NAME)
    await fs.promises.writeFile(filepath, JSON.stringify(data))

    const result = getReportURL(tempDir)

    expect(result).toBe('')
  })
})

function passedCoverageFixture(): string {
  return `\`\`\`diff
@@ Code coverage @@
+ 45% total lines covered
124 lines analyzed, 56 lines covered
+ 33% fresh lines covered
9 lines analyzed, 3 lines covered
# Calculated according to the filters of your coverage tool
\`\`\``
}

function failedCoverageFixture(): string {
  return `\`\`\`diff
@@ Code coverage @@
- 0% total lines covered
100 lines analyzed, 0 lines covered
- 0% fresh lines covered
100 lines analyzed, 0 lines covered
# Calculated according to the filters of your coverage tool
\`\`\``
}