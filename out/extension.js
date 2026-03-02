"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const matcher_1 = require("./matcher");
const logPath = path.join(__dirname, '..', 'C:/dev/gherkin-step-navigator/debug.log');
function logToFile(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
}
function activate(context) {
    console.log('Gherkin Step Navigator is now active.');
    logToFile('Gherkin Step Navigator is now active.');
    const provider = vscode.languages.registerDefinitionProvider({ language: 'gherkin', scheme: 'file' }, {
        async provideDefinition(document, position) {
            const lineText = document.lineAt(position.line).text;
            // Ensure this is awaited so the crawler finishes before matching starts
            const stepDefinitions = await findStepDefinitions(context);
            console.log(`DEBUG - Received ${stepDefinitions.length} definitions for matching`);
            for (const step of stepDefinitions) {
                if (matcher_1.StepMatcher.isMatch(lineText, step.pattern, context.extensionPath)) {
                    return new vscode.Location(vscode.Uri.file(step.file), new vscode.Range(step.line, 0, step.line, 0));
                }
            }
            return [];
        }
    });
    context.subscriptions.push(provider);
}
async function findStepDefinitions(context) {
    logToFile("--- START INDEXING ---");
    let files = [];
    // Log the current environment to the file
    logToFile(`ExtensionPath: ${context.extensionPath}`);
    logToFile(`__dirname: ${__dirname}`);
    // Try finding files via VS Code API first
    const workspaceFiles = await vscode.workspace.findFiles('**/*.cs');
    logToFile(`findFiles found: ${workspaceFiles.length} files`);
    files = [...workspaceFiles];
    if (files.length === 0) {
        logToFile("Workspace empty. Starting manual disk crawl...");
        const getFiles = (dir) => {
            if (!fs.existsSync(dir))
                return [];
            let results = [];
            const list = fs.readdirSync(dir);
            for (let file of list) {
                const fullPath = path.join(dir, file);
                if (fullPath.includes('node_modules'))
                    continue;
                if (fs.statSync(fullPath).isDirectory()) {
                    results = results.concat(getFiles(fullPath));
                }
                else if (fullPath.endsWith('.cs')) {
                    results.push(fullPath);
                }
            }
            return results;
        };
        // We target the root because esbuild might have moved main.js
        const searchRoot = context.extensionPath;
        const found = getFiles(searchRoot);
        logToFile(`Crawler found ${found.length} .cs files on disk.`);
        files = found.map(p => vscode.Uri.file(p));
    }
    const definitions = [];
    for (const file of files) {
        const content = fs.readFileSync(file.fsPath, 'utf8');
        const lines = content.split(/\r?\n/);
        logToFile(`Checking file: ${path.basename(file.fsPath)} (${lines.length} lines)`);
        lines.forEach((line, index) => {
            const pattern = matcher_1.StepMatcher.extractRegex(line, context.extensionPath);
            if (pattern) {
                logToFile(`MATCHED: ${pattern} at line ${index}`);
                definitions.push({ pattern, line: index, file: file.fsPath });
            }
        });
    }
    logToFile(`INDEXING COMPLETE. Total: ${definitions.length}`);
    return definitions;
}
function deactivate() { }
