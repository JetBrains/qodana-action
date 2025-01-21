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

export const FAILURE_LEVEL = 'failure'
export const WARNING_LEVEL = 'warning'
export const NOTICE_LEVEL = 'notice'

export interface Annotation {
    title: string | undefined
    path: string
    start_line: number
    end_line: number
    level: 'failure' | 'warning' | 'notice'
    message: string
    start_column: number | undefined
    end_column: number | undefined
}