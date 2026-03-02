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
    static getKeywords(extensionPath) {
        if (this.cachedKeywords !== null)
            return this.cachedKeywords;
        try {
            // Try multiple possible paths for the grammar file
            const possiblePaths = [
                path.join(extensionPath, 'syntaxes', 'feature.tmLanguage.json'),
                path.join(extensionPath, '..', 'syntaxes', 'feature.tmLanguage.json'), // If running from 'out'
                path.join(__dirname, '..', 'syntaxes', 'feature.tmLanguage.json')
            ];
            let grammarPath = "";
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    grammarPath = p;
                    break;
                }
            }
            if (grammarPath) {
                const content = fs.readFileSync(grammarPath, 'utf8');
                const grammar = JSON.parse(content);
                const repo = grammar.repository;
                const keywordPatterns = [
                    repo.step_keyword?.match,
                    repo.and_keyword?.match,
                    repo.when_keyword?.match,
                    repo.then_keyword?.match,
                    repo.given_keyword?.match
                ].filter(Boolean);
                const allWords = keywordPatterns.flatMap(pattern => {
                    const match = pattern.match(/\((.*)\)/);
                    if (!match)
                        return [];
                    return match[1].split('|').map(k => {
                        return k.replace(/[\\^$*+?.()|[\]{}]/g, '').trim();
                    });
                });
                const uniqueKeywords = [...new Set(allWords)].filter(k => k.length > 0);
                // Re-apply the escape logic to handle apostrophes in French
                this.cachedKeywords = uniqueKeywords
                    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join('|');
                console.log("DEBUG - Successfully loaded keywords from grammar.");
                return this.cachedKeywords;
            }
        }
        catch (err) {
            console.error("DEBUG - Keyword Extraction Failed:", err);
        }
        // UPDATED FALLBACK: Include common languages so tests don't break if file is missing
        console.warn("DEBUG - Using hardcoded fallback keywords!");
        return "Given|When|Then|And|But|Angenommen|Étant donné|Et|Und";
    }
    static extractRegex(line, extensionPath) {
        try {
            const keywords = this.getKeywords(extensionPath);
            const allKeywords = `${keywords}|StepDefinition`;
            // Flexible pattern for C# attributes
            const pattern = `\\[\\s*(?:${allKeywords})\\s*\\(\\s*@?"(.*)"\\s*\\)\\s*\\]`;
            // Use a try-catch specifically for the RegExp constructor
            const regex = new RegExp(pattern, 'i');
            const match = line.match(regex);
            return match ? match[1] : null;
        }
        catch (e) {
            console.error("DEBUG - Regex match failed:", e);
            return null;
        }
    }
    static isMatch(stepText, csharpPattern, extensionPath) {
        try {
            const keywords = this.getKeywords(extensionPath);
            const keywordRegex = new RegExp(`^\\s*(?:${keywords})\\s+`, 'i');
            if (!keywordRegex.test(stepText))
                return false;
            const cleanStep = stepText.replace(keywordRegex, '').trim();
            // Normalize C# verbatim quotes ("") to standard quotes (")
            const cleanPattern = csharpPattern.replace(/""/g, '"').trim();
            const regex = new RegExp(`^${cleanPattern}$`, 'i');
            return regex.test(cleanStep);
        }
        catch (e) {
            return false;
        }
    }
}
exports.StepMatcher = StepMatcher;
StepMatcher.cachedKeywords = null;
