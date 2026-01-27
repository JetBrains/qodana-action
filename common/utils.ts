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
import {parse as shellParse} from 'shell-quote'

export interface Rule {
  shortDescription: string
  fullDescription: string
}

// Callback type for platform-specific deprecation warning
export type DeprecationWarningCallback = (message: string) => void

// Settable callback for platform-specific warning output
let deprecationWarningCallback: DeprecationWarningCallback = (message: string) =>
  console.warn(message)

/**
 * Sets the callback function for deprecation warnings.
 * This allows platform-specific warning output (e.g., core.warning for GitHub Actions).
 * @param callback The function to call with warning messages
 */
export function setDeprecationWarningCallback(
  callback: DeprecationWarningCallback
): void {
  deprecationWarningCallback = callback
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
 * Checks if the parsed tokens look like they came from comma-separated format.
 * This is used to detect a legacy format and trigger deprecation warning.
 * Patterns detected:
 * - standalone comma (from ", --flag" being split on space)
 * - token starting with comma followed by flag: ",--flag" or ",-i"
 * - flag followed by comma: "-i," or "--flag,"
 * - value with trailing comma (from multiline YAML): "value,"
 */
function looksLikeCommaSeparated(tokens: string[]): boolean {
  return tokens.some(t => {
    // Standalone comma (from ", --flag" split into [",", "--flag"])
    if (t === ',') {
      return true
    }
    // Token starts with comma followed by flag: ,--flag or ,-i
    // Using ^ anchor to avoid false positives like --property=list=-1,-2,-3
    if (/^,\s*-{1,2}\w/.test(t)) {
      return true
    }
    // Flag followed by comma: --flag, or -i,frontend
    // This catches tokens like "-i,frontend" or "--property,value"
    if (/^-{1,2}\w[^,]*,/.test(t)) {
      return true
    }
    // Value with trailing comma (from YAML multiline): "value," or "file.json,"
    // Excludes property values with internal commas like "key=a,b,c"
    if (/^[^-=][^=]*,$/.test(t)) {
      return true
    }
    return false
  })
}

/**
 * Parses space-separated arguments with quote support using shell-quote.
 */
function parseSpaceSeparated(input: string): string[] {
  const parsed = shellParse(input, () => undefined) // disable env expansion
  return parsed.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * Parses comma-separated arguments (legacy format).
 * Handles --property to preserve comma-separated values.
 */
function parseCommaSeparated(rawArgs: string): string[] {
  const initialSplit = rawArgs ? rawArgs.split(',').map(arg => arg.trim()) : []
  const result: string[] = []
  let i = 0

  while (i < initialSplit.length) {
    const currentArg = initialSplit[i]

    if (!currentArg) {
      i++
      continue
    }

    // handle --property,prop.name=val1,val2,...
    if (currentArg === '--property') {
      result.push(currentArg)
      const propertyValues: string[] = []

      i++
      while (i < initialSplit.length && !initialSplit[i].startsWith('-')) {
        propertyValues.push(initialSplit[i])
        i++
      }

      result.push(propertyValues.join(','))
      // handle --property prop.name=val1,val2,... (space after --property in segment)
    } else if (currentArg.startsWith('--property ')) {
      result.push('--property')
      const propertyValue = currentArg.slice('--property '.length)
      const propertyParts: string[] = [propertyValue]

      i++
      while (i < initialSplit.length && !initialSplit[i].startsWith('-')) {
        propertyParts.push(initialSplit[i])
        i++
      }

      result.push(propertyParts.join(','))
    } else {
      const parts = currentArg.split(/\s+/).filter(p => p)
      result.push(...parts)
      i++
    }
  }

  return result
}

/**
 * Shows deprecation warning for comma-separated format with suggested fix.
 */
function warnDeprecatedCommaFormat(
  original: string,
  parsed: string[]
): void {
  const suggestedStr = parsed
    .map(arg => (arg.includes(' ') ? `"${arg}"` : arg))
    .join(' ')

  const message =
    `Comma-separated args format is deprecated and will be removed in a future version.\n` +
    `Please switch to space-separated format:\n` +
    `  Current:   "${original.trim()}"\n` +
    `  Suggested: "${suggestedStr}"`

  deprecationWarningCallback(message)
}

/**
 * Parses given arguments represented as string.
 * Supports both space-separated (preferred) and comma-separated (legacy) formats.
 *
 * Space-separated format (recommended):
 *   --log-level debug --config "my config.yaml"
 *
 * Comma-separated format (deprecated):
 *   --log-level,debug,--config,my-config.yaml
 *
 * The function auto-detects the format and shows a deprecation warning
 * when a comma-separated format is used.
 *
 * @param rawArgs string with original arguments
 */
export function parseRawArguments(rawArgs: string): string[] {
  if (!rawArgs || !rawArgs.trim()) {
    return []
  }

  const spaceParsed = parseSpaceSeparated(rawArgs.trim())

  if (looksLikeCommaSeparated(spaceParsed)) {
    const commaParsed = parseCommaSeparated(rawArgs)
    warnDeprecatedCommaFormat(rawArgs, commaParsed)
    return commaParsed
  }

  return spaceParsed
}