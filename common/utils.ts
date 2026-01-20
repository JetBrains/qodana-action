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

// Callback type for platform-specific deprecation warning
export type DeprecationWarningCallback = (message: string) => void

// Module-level flag to ensure a warning is shown only once per run
let deprecationWarningShown = false

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
 * Resets the deprecation warning state. Useful for testing.
 */
export function resetDeprecationWarning(): void {
  deprecationWarningShown = false
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
 * - comma followed by a flag: ",-i" or ",--flag" or ", --flag"
 * - flag followed by comma: "-i," or "--flag,"
 */
function looksLikeCommaSeparated(tokens: string[]): boolean {
  return tokens.some(t => {
    // Pattern 1: comma followed by flag (with optional space): ,--flag or ,-i or , --flag
    if (/,\s*-{1,2}\w/.test(t)) {
      return true
    }
    // Pattern 2: flag followed by comma: --flag, or -i,
    // This catches tokens like "-i,frontend" or "--property,value"
    if (/^-{1,2}\w[^,]*,/.test(t)) {
      return true
    }
    return false
  })
}

/**
 * Shell-style space-separated argument parser with quote support.
 * Handles both single and double quotes for arguments containing spaces.
 */
function parseSpaceSeparated(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let hasQuotes = false // Track if current token had any quotes

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      hasQuotes = true
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      hasQuotes = true
    } else if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current || hasQuotes) {
        tokens.push(current)
        current = ''
        hasQuotes = false
      }
    } else {
      current += char
    }
  }

  if (current || hasQuotes) {
    tokens.push(current)
  }

  return tokens
}

/**
 * Parses comma-separated arguments (legacy format).
 * Handles --property especially to preserve comma-separated values.
 */
function parseCommaSeparated(rawArgs: string): string[] {
  const initialSplit = rawArgs ? rawArgs.split(',').map(arg => arg.trim()) : []
  const result: string[] = []
  let i = 0

  while (i < initialSplit.length) {
    const currentArg = initialSplit[i]

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
      // handle --property prop.name=val1,val2,...
    } else if (currentArg.startsWith('--property ')) {
      const fullPropertyArg: string[] = [currentArg]

      i++
      while (i < initialSplit.length && !initialSplit[i].startsWith('-')) {
        fullPropertyArg.push(initialSplit[i])
        i++
      }

      result.push(fullPropertyArg.join(','))
    } else {
      result.push(currentArg)
      i++
    }
  }

  return result
}

/**
 * Handles --property arguments in space-separated format.
 * Preserves comma-separated values for --property flags.
 */
function handlePropertyArgs(args: string[]): string[] {
  const result: string[] = []
  let i = 0

  while (i < args.length) {
    const currentArg = args[i]

    if (currentArg === '--property' && i + 1 < args.length) {
      result.push(currentArg)
      const propertyParts: string[] = []
      i++

      if (i < args.length) {
        propertyParts.push(args[i])
        i++
      }

      while (i < args.length && !args[i].startsWith('-')) {
        propertyParts.push(args[i])
        i++
      }

      result.push(propertyParts.join(','))
    } else {
      result.push(currentArg)
      i++
    }
  }

  return result
}

/**
 * Shows a deprecation warning for comma-separated format (once per run).
 */
function warnDeprecatedCommaFormat(
  original: string,
  parsed: string[]
): void {
  if (deprecationWarningShown) {
    return
  }
  deprecationWarningShown = true

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

  return handlePropertyArgs(spaceParsed)
}