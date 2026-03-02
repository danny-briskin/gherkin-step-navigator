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
function activate(context) {
    const provider = vscode.languages.registerDefinitionProvider({ language: 'gherkin', scheme: 'file' }, {
        async provideDefinition(document, position) {
            const lineText = document.lineAt(position.line).text;
            const stepDefinitions = await findStepDefinitions(context);
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
    let files = [];
    const config = vscode.workspace.getConfiguration('gherkinStepNavigator');
    const patterns = config.get('stepFilePattern') || ["**/*"];
    for (const pattern of patterns) {
        const glob = pattern.includes('.') ? pattern : `${pattern.replace(/\/$/, '')}/**/*`;
        const matched = await vscode.workspace.findFiles(glob, '**/node_modules/**');
        files = files.concat(matched);
    }
    if (files.length === 0) {
        const getAllFiles = (dir) => {
            let results = [];
            if (!fs.existsSync(dir))
                return results;
            const list = fs.readdirSync(dir);
            for (const file of list) {
                const fullPath = path.join(dir, file);
                if (fullPath.includes('node_modules'))
                    continue;
                if (fs.statSync(fullPath).isDirectory()) {
                    results = results.concat(getAllFiles(fullPath));
                }
                else {
                    results.push(fullPath);
                }
            }
            return results;
        };
        const all = getAllFiles(context.extensionPath);
        files = all.map(p => vscode.Uri.file(p));
    }
    const definitions = [];
    const uniquePaths = [...new Set(files.map(f => f.fsPath))];
    for (const filePath of uniquePaths) {
        if (filePath.endsWith('.feature') || fs.statSync(filePath).size > 500000)
            continue;
        try {
            const buffer = fs.readFileSync(filePath);
            // Basic check for binary files (null bytes)
            if (buffer.includes(0))
                continue;
            const lines = buffer.toString('utf8').split(/\r?\n/);
            lines.forEach((line, index) => {
                const pattern = matcher_1.StepMatcher.extractRegex(line, context.extensionPath);
                if (pattern) {
                    definitions.push({ pattern, line: index, file: filePath });
                }
            });
        }
        catch (err) { }
    }
    return definitions;
}
function deactivate() { }
