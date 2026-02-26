import * as fs from 'fs';
import * as path from 'path';

export interface StepDefinition {
    pattern: string;
    line: number;
    file: string;
}

export class StepMatcher {
    private static cachedKeywords: string | null = null;

    private static getKeywords(extensionPath: string): string {
        if (this.cachedKeywords) return this.cachedKeywords;
        try {
            const grammarPath = path.join(extensionPath, 'syntaxes', 'feature.tmLanguage.json');
            const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
            // This extracts the massive list of international keywords from your JSON
            const rawMatch = grammar.repository.step_keyword.match;
            const keywordList = rawMatch.match(/\((.*)\)/)[1];
            this.cachedKeywords = keywordList;
            return keywordList;
        } catch (e) {
            return "Given|When|Then|And|But"; // Fallback
        }
    }

    public static extractRegex(line: string, extensionPath: string): string | null {
        const keywords = this.getKeywords(extensionPath);
        // Dynamically build the regex using the international keywords
        // Matches: [Given(@"...")] or [前提(@"...")] etc.
        const regex = new RegExp(`\\[(?:${keywords})\\s*\\(@"(.*)"\\)\\]`, 'i');
        const match = line.match(regex);
        return match ? match[1] : null;
    }

    public static isMatch(stepText: string, csharpPattern: string, extensionPath: string): boolean {
        try {
            const keywords = this.getKeywords(extensionPath);
            const keywordRegex = new RegExp(`^\\s*(${keywords})\\s+`, 'i');
            const cleanStep = stepText.replace(keywordRegex, '');

            // Clean C# verbatim quotes (turning "" into ")
            const cleanPattern = csharpPattern.replace(/""/g, '"');

            const regex = new RegExp(`^${cleanPattern}$`);
            return regex.test(cleanStep);
        } catch {
            return false;
        }
    }
}