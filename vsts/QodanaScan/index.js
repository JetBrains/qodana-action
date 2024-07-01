"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../common/cli.json
var version, checksum;
var init_cli = __esm({
  "../common/cli.json"() {
    version = "2024.1.7";
    checksum = {
      windows_x86_64: "c7523a1332f566519111dad70b7f39e25aabe2b4db7790c8eeb0503e8e0bc5a8",
      linux_arm64: "ba196787569f97519d002446844ee72402e3700d86c475c3145088ec9d4dcfc2",
      darwin_arm64: "abaf85c4295760e4c8cc75518c16ea7d68818a2a8438cf8005640b13a87f58af",
      darwin_x86_64: "20b296f31f00e9aac0ab186a85cf13d03d49b737bda5ec37f8ed82316ffa2d45",
      windows_arm64: "26709690340e873b37288beabec93a570fa0530a59fb43cdac3eb7e9df5dc1dc",
      linux_x86_64: "49173d02499c9bf485c02a76315d208d8382cd02cbf0b135dc741a2c74922095"
    };
  }
});

// ../common/qodana.ts
var qodana_exports = {};
__export(qodana_exports, {
  BRANCH: () => BRANCH,
  COVERAGE_THRESHOLD: () => COVERAGE_THRESHOLD,
  EXECUTABLE: () => EXECUTABLE,
  FAIL_THRESHOLD_OUTPUT: () => FAIL_THRESHOLD_OUTPUT,
  NONE: () => NONE,
  PULL_REQUEST: () => PULL_REQUEST,
  QODANA_LICENSES_JSON: () => QODANA_LICENSES_JSON,
  QODANA_LICENSES_MD: () => QODANA_LICENSES_MD,
  QODANA_OPEN_IN_IDE_NAME: () => QODANA_OPEN_IN_IDE_NAME,
  QODANA_REPORT_URL_NAME: () => QODANA_REPORT_URL_NAME,
  QODANA_SARIF_NAME: () => QODANA_SARIF_NAME,
  QODANA_SHORT_SARIF_NAME: () => QODANA_SHORT_SARIF_NAME,
  QodanaExitCode: () => QodanaExitCode,
  SUPPORTED_ARCHS: () => SUPPORTED_ARCHS,
  SUPPORTED_PLATFORMS: () => SUPPORTED_PLATFORMS,
  VERSION: () => VERSION,
  extractArg: () => extractArg,
  getCoverageFromSarif: () => getCoverageFromSarif,
  getProcessArchName: () => getProcessArchName,
  getProcessPlatformName: () => getProcessPlatformName,
  getQodanaPullArgs: () => getQodanaPullArgs,
  getQodanaScanArgs: () => getQodanaScanArgs,
  getQodanaSha256: () => getQodanaSha256,
  getQodanaSha256MismatchMessage: () => getQodanaSha256MismatchMessage,
  getQodanaUrl: () => getQodanaUrl,
  isExecutionSuccessful: () => isExecutionSuccessful,
  isNativeMode: () => isNativeMode,
  sha256sum: () => sha256sum,
  validateBranchName: () => validateBranchName
});
function getQodanaSha256(arch, platform) {
  switch (`${platform}_${arch}`) {
    case "windows_x86_64":
      return checksum["windows_x86_64"];
    case "windows_arm64":
      return checksum["windows_arm64"];
    case "linux_x86_64":
      return checksum["linux_x86_64"];
    case "linux_arm64":
      return checksum["linux_arm64"];
    default:
      throw new Error(`Qodana CLI does not exist for ${platform}_${arch}`);
  }
}
function getProcessArchName() {
  if (process.platform === "darwin") {
    return "all";
  }
  return process.arch === "x64" ? "x86_64" : "arm64";
}
function getProcessPlatformName() {
  return process.platform === "win32" ? "windows" : process.platform;
}
function getQodanaUrl(arch, platform, nightly = false) {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  if (!SUPPORTED_ARCHS.includes(arch)) {
    throw new Error(`Unsupported architecture: ${arch}`);
  }
  const archive = platform === "windows" ? "zip" : "tar.gz";
  const cli_version = nightly ? "nightly" : `v${version}`;
  return `https://github.com/JetBrains/qodana-cli/releases/download/${cli_version}/qodana_${platform}_${arch}.${archive}`;
}
function isExecutionSuccessful(exitCode) {
  return Object.values(QodanaExitCode).includes(exitCode);
}
function extractArg(argShort, argLong, args) {
  let arg = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === argShort || args[i] === argLong) {
      arg = args[i + 1];
      break;
    }
  }
  return arg;
}
function isNativeMode(args) {
  return args.includes("--ide");
}
function getQodanaPullArgs(args) {
  const pullArgs = ["pull"];
  const linter = extractArg("-l", "--linter", args);
  if (linter) {
    pullArgs.push("-l", linter);
  }
  const project = extractArg("-i", "--project-dir", args);
  if (project) {
    pullArgs.push("-i", project);
  }
  const config = extractArg("--config", "--config", args);
  if (config) {
    pullArgs.push("--config", config);
  }
  return pullArgs;
}
function getQodanaScanArgs(args, resultsDir, cacheDir) {
  const cliArgs = [
    "scan",
    "--cache-dir",
    cacheDir,
    "--results-dir",
    resultsDir
  ];
  if (!isNativeMode(args)) {
    cliArgs.push("--skip-pull");
  }
  if (args) {
    cliArgs.push(...args);
  }
  return cliArgs;
}
function getCoverageFromSarif(sarifPath) {
  if (import_fs.default.existsSync(sarifPath)) {
    const sarifContents = JSON.parse(
      import_fs.default.readFileSync(sarifPath, { encoding: "utf8" })
    );
    if (sarifContents.runs[0].properties["coverage"]) {
      return {
        totalCoverage: sarifContents.runs[0].properties["coverage"]["totalCoverage"] || 0,
        totalLines: sarifContents.runs[0].properties["coverage"]["totalLines"] || 0,
        totalCoveredLines: sarifContents.runs[0].properties["coverage"]["totalCoveredLines"] || 0,
        freshCoverage: sarifContents.runs[0].properties["coverage"]["freshCoverage"] || 0,
        freshLines: sarifContents.runs[0].properties["coverage"]["freshLines"] || 0,
        freshCoveredLines: sarifContents.runs[0].properties["coverage"]["freshCoveredLines"] || 0
      };
    } else {
      return {
        totalCoverage: 0,
        totalLines: 0,
        totalCoveredLines: 0,
        freshCoverage: 0,
        freshLines: 0,
        freshCoveredLines: 0
      };
    }
  }
  throw new Error(`SARIF file not found: ${sarifPath}`);
}
function sha256sum(file) {
  const hash = (0, import_crypto.createHash)("sha256");
  hash.update(import_fs.default.readFileSync(file));
  return hash.digest("hex");
}
function getQodanaSha256MismatchMessage(expected, actual) {
  return `Downloaded Qodana CLI binary is corrupted. Expected SHA-256 checksum: ${expected}, actual checksum: ${actual}`;
}
function validateBranchName(branchName) {
  const validBranchNameRegex = /^[a-zA-Z0-9/\-_.]+$/;
  if (!validBranchNameRegex.test(branchName)) {
    throw new Error(
      `Invalid branch name: not allowed characters are used: ${branchName}`
    );
  }
  return branchName;
}
var import_crypto, import_fs, SUPPORTED_PLATFORMS, SUPPORTED_ARCHS, FAIL_THRESHOLD_OUTPUT, QODANA_SARIF_NAME, QODANA_SHORT_SARIF_NAME, QODANA_REPORT_URL_NAME, QODANA_OPEN_IN_IDE_NAME, QODANA_LICENSES_MD, QODANA_LICENSES_JSON, EXECUTABLE, VERSION, COVERAGE_THRESHOLD, QodanaExitCode, NONE, BRANCH, PULL_REQUEST;
var init_qodana = __esm({
  "../common/qodana.ts"() {
    "use strict";
    init_cli();
    import_crypto = require("crypto");
    import_fs = __toESM(require("fs"));
    SUPPORTED_PLATFORMS = ["windows", "linux"];
    SUPPORTED_ARCHS = ["x86_64", "arm64"];
    FAIL_THRESHOLD_OUTPUT = "The number of problems exceeds the failThreshold";
    QODANA_SARIF_NAME = "qodana.sarif.json";
    QODANA_SHORT_SARIF_NAME = "qodana-short.sarif.json";
    QODANA_REPORT_URL_NAME = "qodana.cloud";
    QODANA_OPEN_IN_IDE_NAME = "open-in-ide.json";
    QODANA_LICENSES_MD = "thirdPartySoftwareList.md";
    QODANA_LICENSES_JSON = "third-party-libraries.json";
    EXECUTABLE = "qodana";
    VERSION = version;
    COVERAGE_THRESHOLD = 50;
    QodanaExitCode = /* @__PURE__ */ ((QodanaExitCode2) => {
      QodanaExitCode2[QodanaExitCode2["Success"] = 0] = "Success";
      QodanaExitCode2[QodanaExitCode2["FailThreshold"] = 255] = "FailThreshold";
      return QodanaExitCode2;
    })(QodanaExitCode || {});
    NONE = "none";
    BRANCH = "branch";
    PULL_REQUEST = "pull-request";
  }
});

// lib/utils.js
var require_utils = __commonJS({
  "lib/utils.js"(exports2) {
    "use strict";
    var __createBinding2 = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault2 = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar2 = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding2(result, mod, k);
      }
      __setModuleDefault2(result, mod);
      return result;
    };
    var __awaiter2 = exports2 && exports2.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.setFailed = setFailed;
    exports2.getInputs = getInputs;
    exports2.qodana = qodana;
    exports2.prepareAgent = prepareAgent;
    exports2.uploadArtifacts = uploadArtifacts;
    exports2.uploadSarif = uploadSarif;
    var compress = __importStar2(require("azure-pipelines-tasks-utility-common/compressutility"));
    var tl2 = __importStar2(require("azure-pipelines-task-lib/task"));
    var tool = __importStar2(require("azure-pipelines-tool-lib"));
    var qodana_12 = (init_qodana(), __toCommonJS(qodana_exports));
    var path = require("path");
    function setFailed(message) {
      tl2.setResult(tl2.TaskResult.Failed, message);
    }
    function getInputs() {
      const home = path.join(process.env["AGENT_TEMPDIRECTORY"], "qodana");
      return {
        args: (tl2.getInput("args", false) || "").split(",").map((arg) => arg.trim()),
        resultsDir: tl2.getInput("resultsDir", false) || path.join(home, "results"),
        cacheDir: tl2.getInput("cacheDir", false) || path.join(home, "cache"),
        uploadResult: tl2.getBoolInput("uploadResult", false) || false,
        uploadSarif: tl2.getBoolInput("uploadSarif", false) || true,
        artifactName: tl2.getInput("artifactName", false) || "qodana-report",
        useNightly: tl2.getBoolInput("useNightly", false) || false,
        // Not used by the Azure task
        postComment: false,
        additionalCacheKey: "",
        primaryCacheKey: "",
        useAnnotations: false,
        useCaches: false,
        cacheDefaultBranchOnly: false,
        prMode: false,
        githubToken: "",
        pushFixes: "none",
        commitMessage: ""
      };
    }
    function qodana() {
      return __awaiter2(this, arguments, void 0, function* (args = []) {
        if (args.length === 0) {
          const inputs = getInputs();
          args = (0, qodana_12.getQodanaScanArgs)(inputs.args, inputs.resultsDir, inputs.cacheDir);
        }
        return tl2.exec(qodana_12.EXECUTABLE, args, {
          ignoreReturnCode: true,
          env: Object.assign(Object.assign({}, process.env), { NONINTERACTIVE: "1" })
        });
      });
    }
    function prepareAgent(args_1) {
      return __awaiter2(this, arguments, void 0, function* (args, useNightly = false) {
        const arch = (0, qodana_12.getProcessArchName)();
        const platform = (0, qodana_12.getProcessPlatformName)();
        const temp = yield tool.downloadTool((0, qodana_12.getQodanaUrl)(arch, platform));
        if (!useNightly) {
          const expectedChecksum = (0, qodana_12.getQodanaSha256)(arch, platform);
          const actualChecksum = (0, qodana_12.sha256sum)(temp);
          if (expectedChecksum !== actualChecksum) {
            setFailed((0, qodana_12.getQodanaSha256MismatchMessage)(expectedChecksum, actualChecksum));
          }
        }
        let extractRoot;
        if (process.platform === "win32") {
          extractRoot = yield tool.extractZip(temp);
        } else {
          extractRoot = yield tool.extractTar(temp);
        }
        tool.prependPath(yield tool.cacheDir(extractRoot, qodana_12.EXECUTABLE, useNightly ? "nightly" : qodana_12.VERSION));
        if (!(0, qodana_12.isNativeMode)(args)) {
          const pull = yield qodana((0, qodana_12.getQodanaPullArgs)(args));
          if (pull !== 0) {
            setFailed("Unable to run 'qodana pull'");
          }
        }
      });
    }
    function uploadArtifacts(resultsDir, artifactName, execute) {
      return __awaiter2(this, void 0, void 0, function* () {
        if (!execute) {
          return;
        }
        try {
          const parentDir = path.dirname(resultsDir);
          const archivePath = path.join(parentDir, `${artifactName}.zip`);
          compress.createArchive(resultsDir, "zip", archivePath);
          tl2.uploadArtifact("Qodana", archivePath, artifactName);
        } catch (error) {
          tl2.warning(`Failed to upload report \u2013 ${error.message}`);
        }
      });
    }
    function uploadSarif(resultsDir, execute) {
      return __awaiter2(this, void 0, void 0, function* () {
        if (!execute) {
          return;
        }
        try {
          const parentDir = path.dirname(resultsDir);
          const qodanaSarif = path.join(parentDir, "qodana.sarif");
          tl2.cp(path.join(resultsDir, "qodana.sarif.json"), qodanaSarif);
          tl2.uploadArtifact("CodeAnalysisLogs", qodanaSarif, "CodeAnalysisLogs");
        } catch (error) {
          tl2.warning(`Failed to upload SARIF \u2013 ${error.message}`);
        }
      });
    }
  }
});

// lib/main.js
var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
  if (k2 === void 0) k2 = k;
  var desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { enumerable: true, get: function() {
      return m[k];
    } };
  }
  Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
  if (k2 === void 0) k2 = k;
  o[k2] = m[k];
});
var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
  Object.defineProperty(o, "default", { enumerable: true, value: v });
} : function(o, v) {
  o["default"] = v;
});
var __importStar = exports && exports.__importStar || function(mod) {
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) {
    for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
  }
  __setModuleDefault(result, mod);
  return result;
};
var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
Object.defineProperty(exports, "__esModule", { value: true });
var tl = __importStar(require("azure-pipelines-task-lib/task"));
var qodana_1 = (init_qodana(), __toCommonJS(qodana_exports));
var utils_1 = require_utils();
process.on("uncaughtException", (e) => tl.warning(e.message));
function main() {
  return __awaiter(this, void 0, void 0, function* () {
    try {
      const inputs = (0, utils_1.getInputs)();
      tl.mkdirP(inputs.resultsDir);
      tl.mkdirP(inputs.cacheDir);
      yield (0, utils_1.prepareAgent)(inputs.args);
      const exitCode = yield (0, utils_1.qodana)();
      yield (0, utils_1.uploadArtifacts)(inputs.resultsDir, inputs.artifactName, inputs.uploadResult);
      yield (0, utils_1.uploadSarif)(inputs.resultsDir, inputs.uploadSarif);
      if (!(0, qodana_1.isExecutionSuccessful)(exitCode)) {
        (0, utils_1.setFailed)(`qodana scan failed with exit code ${exitCode}`);
      } else if (exitCode === qodana_1.QodanaExitCode.FailThreshold) {
        (0, utils_1.setFailed)(qodana_1.FAIL_THRESHOLD_OUTPUT);
      }
    } catch (error) {
      (0, utils_1.setFailed)(error.message);
    }
  });
}
main();
