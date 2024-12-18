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

module.exports = {
  parserPreset: {
    parserOpts: {
      // Extracts the gitmoji as 'type' and the remainder as 'subject'
      headerPattern: /^(:\w+:)\s(.*)$/,
      headerCorrespondence: ['type', 'subject']
    }
  },
  rules: {
    // Disable conventional type checks
    'type-enum': [0],
    // Ensure there's always a type (gitmoji)
    'type-empty': [2, 'never'],
    // Ensure there's always a subject after the gitmoji
    'subject-empty': [2, 'never'],
    // You could add other rules like max length or no trailing period if desired
  }
};