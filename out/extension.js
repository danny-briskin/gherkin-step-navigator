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
const matcher_1 = require("./matcher");
function activate(context) {
    console.log('Gherkin Step Navigator is now active.');
    const provider = vscode.languages.registerDefinitionProvider({ language: 'gherkin', scheme: 'file' }, {
        async provideDefinition(document, position) {
            const lineText = document.lineAt(position.line).text;
            const stepDefinitions = await findStepDefinitions();
            for (const step of stepDefinitions) {
                if (matcher_1.StepMatcher.isMatch(lineText, step.pattern)) {
                    const targetUri = vscode.Uri.file(step.file);
                    const targetRange = new vscode.Range(new vscode.Position(step.line, 0), new vscode.Position(step.line, 0));
                    return new vscode.Location(targetUri, targetRange);
                }
            }
            return [];
        }
    });
    context.subscriptions.push(provider);
}
async function findStepDefinitions() {
    const definitions = [];
    // Search for all .cs files in the workspace
    const files = await vscode.workspace.findFiles('**/*.cs', '**/node_modules/**');
    for (const file of files) {
        const content = fs.readFileSync(file.fsPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            const pattern = matcher_1.StepMatcher.extractRegex(line);
            if (pattern) {
                definitions.push({
                    pattern: pattern,
                    line: index,
                    file: file.fsPath
                });
            }
        });
    }
    return definitions;
}
function deactivate() { }
