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

import {expect, test, describe, beforeEach} from '@jest/globals'
import {getCoverageFromSarif, QODANA_OPEN_IN_IDE_NAME, QODANA_REPORT_URL_NAME} from "../qodana";
import {
  getCoverageStats,
  getReportURL, parseSarif
} from '../output'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {outputEmptyFixture, problemDescriptorsDefaultFixture} from './common.test.utils'
import {
  parseRawArguments,
  resetDeprecationWarning,
  setDeprecationWarningCallback
} from '../utils'

test('test passed coverage output using diff', () => {
  const result = getCoverageStats(
    getCoverageFromSarif('__tests__/data/some.sarif.json'),
    true
  )
  expect(result).toEqual(passedCoverageFixtureDiff())
})

test('test failed coverage output using diff', () => {
  const result = getCoverageStats(
    getCoverageFromSarif('__tests__/data/empty.sarif.json'),
    true
  )
  expect(result).toEqual(failedCoverageFixtureDiff())
})

test('test passed coverage output using spam', () => {
  const result = getCoverageStats(
    getCoverageFromSarif('__tests__/data/some.sarif.json'),
    false
  )
  expect(result).toEqual(passedCoverageFixtureSpam())
})

test('test failed coverage output using spam', () => {
  const result = getCoverageStats(
    getCoverageFromSarif('__tests__/data/empty.sarif.json'),
    false
  )
  expect(result).toEqual(failedCoverageFixtureSpam())
})

test('test sarif with problems to output annotations', () => {
  const output = problemDescriptorsDefaultFixture()
  const result = parseSarif(
    '__tests__/data/some.sarif.json',
    "This is a test help string"
  )
  expect(result.problemDescriptions).toEqual(output)
})

test('test sarif with problems and baseline to output annotations', () => {
  const output = problemDescriptorsDefaultFixture()
  const result = parseSarif(
    '__tests__/data/with.baseline.sarif.json',
    "This is a test help string"
  )
  expect(result.problemDescriptions).toEqual(output)
})

test('test sarif with no problems to output annotations', () => {
  const output = outputEmptyFixture()
  const result = parseSarif(
    '__tests__/data/empty.sarif.json',
    "This is a test help string"
  )
  expect(result.problemDescriptions).toEqual(output)
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

function passedCoverageFixtureSpam(): string {
  return `@@ Code coverage @@
<span style="background-color: #e6f4e6; color: green;">45% total lines covered</span>
124 lines analyzed, 56 lines covered
<span style="background-color: #e6f4e6; color: green;">33% fresh lines covered</span>
9 lines analyzed, 3 lines covered
# Calculated according to the filters of your coverage tool`
}

function failedCoverageFixtureSpam(): string {
  return `@@ Code coverage @@
<span style="background-color: #ffe6e6; color: red;">0% total lines covered</span>
100 lines analyzed, 0 lines covered
<span style="background-color: #ffe6e6; color: red;">0% fresh lines covered</span>
100 lines analyzed, 0 lines covered
# Calculated according to the filters of your coverage tool`
}

function passedCoverageFixtureDiff(): string {
  return `\`\`\`diff
@@ Code coverage @@
+ 45% total lines covered
124 lines analyzed, 56 lines covered
+ 33% fresh lines covered
9 lines analyzed, 3 lines covered
# Calculated according to the filters of your coverage tool
\`\`\``
}

function failedCoverageFixtureDiff(): string {
  return `\`\`\`diff
@@ Code coverage @@
- 0% total lines covered
100 lines analyzed, 0 lines covered
- 0% fresh lines covered
100 lines analyzed, 0 lines covered
# Calculated according to the filters of your coverage tool
\`\`\``
}

describe('parseRawArguments', () => {
  beforeEach(() => {
    resetDeprecationWarning()
  })

  describe('space-separated format (preferred)', () => {
    test('empty string returns empty array', () => {
      expect(parseRawArguments('')).toEqual([])
    })

    test('whitespace only returns empty array', () => {
      expect(parseRawArguments('   ')).toEqual([])
    })

    test('single argument', () => {
      expect(parseRawArguments('--print-problems')).toEqual(['--print-problems'])
    })

    test('basic flags with values', () => {
      expect(parseRawArguments('--log-level debug')).toEqual([
        '--log-level',
        'debug'
      ])
    })

    test('multiple arguments', () => {
      expect(parseRawArguments('-i frontend --print-problems')).toEqual([
        '-i',
        'frontend',
        '--print-problems'
      ])
    })

    test('multiple spaces are collapsed', () => {
      expect(parseRawArguments('--flag   value')).toEqual(['--flag', 'value'])
    })

    test('leading and trailing spaces are trimmed', () => {
      expect(parseRawArguments('  --flag value  ')).toEqual(['--flag', 'value'])
    })

    test('property with single value', () => {
      expect(parseRawArguments('--property idea.log.level=trace')).toEqual([
        '--property',
        'idea.log.level=trace'
      ])
    })

    test('property with comma-separated values (preserved)', () => {
      expect(
        parseRawArguments('--property key=val1,val2,val3 --other')
      ).toEqual(['--property', 'key=val1,val2,val3', '--other'])
    })

    test('multiple properties', () => {
      expect(
        parseRawArguments('--property a=1 --property b=2')
      ).toEqual(['--property', 'a=1', '--property', 'b=2'])
    })

    test('complex real-world example', () => {
      expect(
        parseRawArguments(
          '-l qodana-jvm --property qodana.format.replace.with.style=spotless,ktfmt --property idea.headless.enable.statistics=false --fail-threshold 10 --print-problems'
        )
      ).toEqual([
        '-l',
        'qodana-jvm',
        '--property',
        'qodana.format.replace.with.style=spotless,ktfmt',
        '--property',
        'idea.headless.enable.statistics=false',
        '--fail-threshold',
        '10',
        '--print-problems'
      ])
    })

    test('equals in value', () => {
      expect(parseRawArguments('--property key=val=ue')).toEqual([
        '--property',
        'key=val=ue'
      ])
    })

    test('numeric values', () => {
      expect(parseRawArguments('--threshold 10')).toEqual(['--threshold', '10'])
    })

    test('path-like values', () => {
      expect(parseRawArguments('--config ./path/to/file.yaml')).toEqual([
        '--config',
        './path/to/file.yaml'
      ])
    })
  })

  describe('quoted arguments', () => {
    test('double quotes preserve spaces', () => {
      expect(parseRawArguments('--config "my config.yaml"')).toEqual([
        '--config',
        'my config.yaml'
      ])
    })

    test('single quotes preserve spaces', () => {
      expect(parseRawArguments("--config 'my config.yaml'")).toEqual([
        '--config',
        'my config.yaml'
      ])
    })

    test('quoted value with multiple words', () => {
      expect(
        parseRawArguments('--config "path/to/my file.yaml" --verbose')
      ).toEqual(['--config', 'path/to/my file.yaml', '--verbose'])
    })

    test('mixed quotes - double containing apostrophe', () => {
      expect(parseRawArguments('--msg "it\'s working"')).toEqual([
        '--msg',
        "it's working"
      ])
    })

    test('mixed quotes - single containing double', () => {
      expect(parseRawArguments("--msg 'say \"hello\"'")).toEqual([
        '--msg',
        'say "hello"'
      ])
    })

    test('empty quoted string', () => {
      expect(parseRawArguments('--value ""')).toEqual(['--value', ''])
    })

    test('quotes in middle of value are stripped', () => {
      expect(parseRawArguments('--path some"quoted"path')).toEqual([
        '--path',
        'somequotedpath'
      ])
    })

    test('unclosed quote treats rest as quoted', () => {
      expect(parseRawArguments('--config "unclosed')).toEqual([
        '--config',
        'unclosed'
      ])
    })

    test('multiple quoted arguments', () => {
      expect(
        parseRawArguments('--first "arg one" --second "arg two"')
      ).toEqual(['--first', 'arg one', '--second', 'arg two'])
    })
  })

  describe('comma-separated format (legacy, triggers warning)', () => {
    let warningMessage: string | null = null

    beforeEach(() => {
      warningMessage = null
      setDeprecationWarningCallback((msg: string) => {
        warningMessage = msg
      })
    })

    test('simple arguments', () => {
      expect(parseRawArguments('-i,frontend,--print-problems')).toEqual([
        '-i',
        'frontend',
        '--print-problems'
      ])
      expect(warningMessage).toContain('deprecated')
    })

    test('arguments with whitespace are trimmed', () => {
      expect(parseRawArguments(' -i, frontend, --print-problems ')).toEqual([
        '-i',
        'frontend',
        '--print-problems'
      ])
    })

    test('property with single value', () => {
      expect(parseRawArguments('--property,idea.log.level=trace')).toEqual([
        '--property',
        'idea.log.level=trace'
      ])
    })

    test('property with comma-separated values', () => {
      expect(
        parseRawArguments('--property,property.name=value1,value2,value3')
      ).toEqual(['--property', 'property.name=value1,value2,value3'])
    })

    test('multiple properties', () => {
      expect(
        parseRawArguments(
          '--property,prop1=val1,--property,prop2=val2,val3,--print-problems'
        )
      ).toEqual([
        '--property',
        'prop1=val1',
        '--property',
        'prop2=val2,val3',
        '--print-problems'
      ])
    })

    test('mixed arguments with property in the middle', () => {
      expect(
        parseRawArguments(
          '-i,frontend,--property,idea.log.level=trace,debug,--print-problems'
        )
      ).toEqual([
        '-i',
        'frontend',
        '--property',
        'idea.log.level=trace,debug',
        '--print-problems'
      ])
    })

    test('property at the end with multiple values', () => {
      expect(
        parseRawArguments('--print-problems,--property,prop=a,b,c')
      ).toEqual(['--print-problems', '--property', 'prop=a,b,c'])
    })

    test('property with values followed by short option', () => {
      expect(parseRawArguments('--property,prop=x,y,-l,qodana-jvm')).toEqual([
        '--property',
        'prop=x,y',
        '-l',
        'qodana-jvm'
      ])
    })

    test('complex real-world example', () => {
      expect(
        parseRawArguments(
          '-l,qodana-jvm,--property,qodana.format.replace.with.style=spotless,ktfmt,--property,idea.headless.enable.statistics=false,--fail-threshold,10,--print-problems'
        )
      ).toEqual([
        '-l',
        'qodana-jvm',
        '--property',
        'qodana.format.replace.with.style=spotless,ktfmt',
        '--property',
        'idea.headless.enable.statistics=false',
        '--fail-threshold',
        '10',
        '--print-problems'
      ])
    })

    test('warning includes current and suggested format', () => {
      parseRawArguments('-i,frontend,--print-problems')
      expect(warningMessage).toContain('Current:')
      expect(warningMessage).toContain('Suggested:')
      expect(warningMessage).toContain('-i frontend --print-problems')
    })

    test('warning is shown only once per run', () => {
      let callCount = 0
      setDeprecationWarningCallback(() => {
        callCount++
      })

      parseRawArguments('-i,frontend')
      parseRawArguments('-l,qodana-jvm')

      expect(callCount).toBe(1)
    })
  })

  describe('edge cases and mixed scenarios', () => {
    test('commas in property values do not trigger legacy detection', () => {
      // This looks like it has commas but they are property values, not separators
      let warningMessage: string | null = null
      setDeprecationWarningCallback((msg: string) => {
        warningMessage = msg
      })

      expect(parseRawArguments('--property key=a,b,c --flag')).toEqual([
        '--property',
        'key=a,b,c',
        '--flag'
      ])
      expect(warningMessage).toBeNull()
    })

    test('newlines are not split (YAML handles this)', () => {
      // YAML multiline strings with > convert newlines to spaces before reaching parser
      // So actual newlines in raw input are kept as-is
      expect(parseRawArguments('--flag\nvalue')).toEqual(['--flag\nvalue'])
    })

    test('tabs are treated as regular characters', () => {
      expect(parseRawArguments('--flag\tvalue')).toEqual(['--flag\tvalue'])
    })
  })
})