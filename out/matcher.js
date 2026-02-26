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
exports.StepMatcher = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class StepMatcher {
    // Dynamically build the keyword list from your tmLanguage file
    static getKeywords(extensionPath) {
        if (this.cachedKeywords)
            return this.cachedKeywords;
        try {
            const grammarPath = path.join(extensionPath, 'syntaxes', 'feature.tmLanguage.json');
            const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
            // Extract the massive regex string from step_keyword.match
            const rawMatch = grammar.repository.step_keyword.match;
            // The keywords are in the first capture group: ^\s*(LIST_HERE):
            const keywordList = rawMatch.match(/\((.*)\)/)[1];
            this.cachedKeywords = keywordList;
            return keywordList;
        }
        catch (e) {
            // Fallback to English if file reading fails
            return "Given|When|Then|And|But";
        }
    }
    static isMatch(stepText, csharpPattern, extensionPath) {
        try {
            const keywords = this.getKeywords(extensionPath);
            // Create a regex that strips ANY valid Gherkin keyword from any language
            const keywordRegex = new RegExp(`^\\s*(${keywords})\\s+`, 'i');
            const cleanStep = stepText.replace(keywordRegex, '');
            const regex = new RegExp(`^${csharpPattern}$`);
            return regex.test(cleanStep);
        }
        catch {
            return false;
        }
    }
}
exports.StepMatcher = StepMatcher;
StepMatcher.cachedKeywords = null;
