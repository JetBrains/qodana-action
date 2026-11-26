/*
 * Copyright 2021-2026 JetBrains s.r.o.
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

// The public API of @qodana/ci-common: only what is listed here can be imported by other packages.

export {
  BRANCH,
  compressFolder,
  ENV_VARS_TO_LINTER_NATIVE_WARNING,
  EXECUTABLE,
  extractArg,
  FAIL_THRESHOLD_OUTPUT,
  getCoverageFromSarif,
  getNativeModePrefix,
  getNightlyTag,
  getProcessArchName,
  getProcessPlatformName,
  getQodanaPullArgs,
  getQodanaScanArgs,
  getQodanaSha256,
  getQodanaSha256MismatchMessage,
  getQodanaUrl,
  getSanityProblemsCount,
  isExecutionSuccessful,
  isNativeMode,
  isPullSkipped,
  NONE,
  parseEnvVarNames,
  PULL_REQUEST,
  QODANA_SARIF_NAME,
  QODANA_SHORT_SARIF_NAME,
  QodanaExitCode,
  sha256sum,
  SUPPORTED_ARCHS,
  SUPPORTED_PLATFORMS,
  validateBranchName,
  VERSION
} from './qodana'
export type {Inputs, PushFixesType} from './qodana'

export {
  COMMIT_EMAIL,
  COMMIT_USER,
  FAILURE_LEVEL,
  getCommentTag,
  getCoverageStats,
  getLicenseInfo,
  getProblemPlural,
  getReportURL,
  getSummary,
  NOTICE_LEVEL,
  parseSarif,
  QODANA_CHECK_NAME,
  WARNING_LEVEL
} from './output'
export type {LicenseInfo, ProblemDescriptor} from './output'

export {
  gitExtraHeaderEnv,
  isMergeCommit,
  MERGE_COMMIT_PARENTS_ARGS,
  MERGE_COMMIT_PR_WARNING,
  parseRawArguments,
  parseRules,
  setDeprecationWarningCallback
} from './utils'
export type {Rule} from './utils'
