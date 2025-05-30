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

import type {Tool} from 'sarif'

export interface Rule {
  shortDescription: string
  fullDescription: string
}

/**
 * Extracts the rules descriptions from SARIF tool field.
 * @param tool the SARIF tool field.
 * @returns The map of SARIF rule IDs to their descriptions.
 */
export function parseRules(tool: Tool): Map<string, Rule> {
  const rules = new Map<string, Rule>()
  tool.driver.rules?.forEach(rule => {
    rules.set(rule.id, {
      shortDescription: rule.shortDescription!.text,
      fullDescription:
        rule.fullDescription!.markdown || rule.fullDescription!.text
    })
  })

  tool?.extensions?.forEach(ext => {
    ext?.rules?.forEach(rule => {
      rules.set(rule.id, {
        shortDescription: rule.shortDescription!.text,
        fullDescription:
          rule.fullDescription!.markdown || rule.fullDescription!.text
      })
    })
  })
  return rules
}

/**
 * Parses given arguments represented as string with respect to --property
 * This implementation relies on the fact
 * that all arguments in qodana cli are passed using some option which starts with '-'
 * The values in the list for property shouldn't start with '-'
 * @param rawArgs string with original arguments
 */
export function parseRawArguments(rawArgs: string): string[] {
  const initialSplit = rawArgs ? rawArgs.split(',').map(arg => arg.trim()) : []
  const result: string[] = []
  let i = 0

  while (i < initialSplit.length) {
    let currentArg = initialSplit[i]

    if (currentArg.startsWith('--property=')) {
      let propertyValue = currentArg
      i++
      while (i < initialSplit.length && !initialSplit[i].startsWith('-')) {
        propertyValue += ',' + initialSplit[i]
        i++
      }
      result.push(propertyValue)
    } else {
      result.push(currentArg)
      i++
    }
  }

  return result
}