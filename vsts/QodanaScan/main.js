"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadReport = exports.prepareAgent = exports.qodana = exports.getInputs = void 0;
const compress = require("azure-pipelines-tasks-utility-common/compressutility");
const tl = require("azure-pipelines-task-lib/task");
const tool = require("azure-pipelines-tool-lib");
const ci_common_1 = require("@qodana/ci-common");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// Catch and log any unhandled exceptions. These exceptions can leak out in
// azure-pipelines-task-lib when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on('uncaughtException', e => tl.warning(e.message));
function setFailed(message) {
    tl.setResult(tl.TaskResult.Failed, message);
}
/**
 * The context for the task.
 * @returns The Azure DevOps Pipeline inputs.
 */
function getInputs() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const home = path.join(process.env['AGENT_TEMPDIRECTORY'], 'qodana');
    return {
        args: (tl.getInput('args', false) || '').split(','),
        resultsDir: tl.getInput('resultsDir', false) || path.join(home, 'results'),
        cacheDir: tl.getInput('cacheDir', false) || path.join(home, 'cache'),
        uploadResults: tl.getBoolInput('uploadResults', false) || true,
        artifactName: tl.getInput('artifactName', false) || 'qodana-report',
        // Not used by the task
        additionalCacheHash: '',
        githubToken: '',
        useAnnotations: false,
        useCaches: false
    };
}
exports.getInputs = getInputs;
/**
 * Runs the qodana command with the given arguments.
 * @param args docker command arguments.
 * @returns The qodana command execution output.
 */
function qodana(args = []) {
    return __awaiter(this, void 0, void 0, function* () {
        if (args.length === 0) {
            const inputs = getInputs();
            args = ci_common_1.getQodanaScanArgs(inputs);
        }
        return tl.exec(ci_common_1.EXECUTABLE, args, {
            ignoreReturnCode: true
        });
    });
}
exports.qodana = qodana;
/**
 * Prepares the agent for qodana scan: install Qodana CLI and pull the linter.
 * @param args qodana arguments
 */
function prepareAgent(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const temp = yield tool.downloadTool(ci_common_1.getQodanaCliUrl());
        let extractRoot;
        if (process.platform === 'win32') {
            extractRoot = yield tool.extractZip(temp);
        }
        else {
            extractRoot = yield tool.extractTar(temp);
        }
        tool.prependPath(yield tool.cacheDir(extractRoot, ci_common_1.EXECUTABLE, ci_common_1.VERSION));
        const pullArgs = ['pull'];
        const linter = ci_common_1.extractArgsLinter(args);
        if (linter) {
            pullArgs.push('-l', linter);
        }
        const pull = yield qodana(pullArgs);
        if (pull !== 0) {
            tl.setResult(tl.TaskResult.Failed, "Unable to run 'qodana pull'");
            return;
        }
    });
}
exports.prepareAgent = prepareAgent;
/**
 * Uploads the Qodana report files from temp directory to Azure DevOps Pipelines job artifact.
 * @param resultsDir The path to upload report from.
 * @param artifactName Artifact upload name.
 * @param execute whether to execute promise or not.
 */
function uploadReport(resultsDir, artifactName, execute) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!execute) {
            return;
        }
        try {
            const parentDir = path.dirname(resultsDir);
            const archivePath = path.join(parentDir, `${artifactName}.zip`);
            compress.createArchive(resultsDir, 'zip', archivePath);
            tl.uploadArtifact('Qodana', archivePath, artifactName);
            const qodanaSarif = path.join(parentDir, 'qodana.sarif');
            tl.cp(path.join(resultsDir, 'qodana.sarif.json'), qodanaSarif);
            tl.uploadArtifact('CodeAnalysisLogs', qodanaSarif, 'CodeAnalysisLogs');
        }
        catch (error) {
            tl.warning(`Failed to upload report – ${error.message}`);
        }
    });
}
exports.uploadReport = uploadReport;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const inputs = getInputs();
            tl.mkdirP(inputs.resultsDir);
            tl.mkdirP(inputs.cacheDir);
            yield Promise.all([prepareAgent(inputs.args)]);
            const exitCode = yield qodana();
            const failedByThreshold = ci_common_1.isFailedByThreshold(exitCode);
            yield Promise.all([
                uploadReport(inputs.resultsDir, inputs.artifactName, inputs.uploadResults)
            ]);
            if (!ci_common_1.isExecutionSuccessful(exitCode)) {
                setFailed(`qodana scan failed with exit code ${exitCode}`);
            }
            else if (failedByThreshold) {
                setFailed(ci_common_1.FAIL_THRESHOLD_OUTPUT);
            }
        }
        catch (error) {
            setFailed(error.message);
        }
    });
}
// noinspection JSIgnoredPromiseFromCall
main();
