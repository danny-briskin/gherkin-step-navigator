import * as fs from 'fs';
import * as path from 'path';

export class StepMatcher {
    private static cachedGrammar: any = null;
    private static cachedKeywords: string | null = null;

    private static getGrammar(extensionPath: string | undefined): any {
        if (this.cachedGrammar) return this.cachedGrammar;

        const possiblePaths = [
            // Path when running as an installed extension
            ...(extensionPath ? [path.join(extensionPath, 'syntaxes', 'feature.tmLanguage.json')] : []),
            // Path when running from 'out/test/suite'
            path.join(__dirname, '..', '..', 'syntaxes', 'feature.tmLanguage.json'),
            // Path when running from 'out/src'
            path.join(__dirname, '..', 'syntaxes', 'feature.tmLanguage.json'),
            // absolute path fallback for local dev
            path.resolve(__dirname, '../../syntaxes/feature.tmLanguage.json')
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                console.log(`DEBUG: [GRAMMAR] Successfully loaded from ${p}`);
                this.cachedGrammar = JSON.parse(fs.readFileSync(p, 'utf8'));
                return this.cachedGrammar;
            }
        }

        console.error("DEBUG: [GRAMMAR] All search paths failed. Falling back to English defaults.");
        return null;
    }

    private static getKeywords(extensionPath: string): string {
        if (this.cachedKeywords !== null) return this.cachedKeywords;

        const grammar = this.getGrammar(extensionPath);
        if (grammar) {
            let rawMatch = grammar.repository.step_keyword.match;

            // CLEANING LOGIC:
            // 1. Remove the tmLanguage anchors and outer groups
            let cleaned = rawMatch
                .replace(/^\^\\s\*\(/, '')
                .replace(/\)\s*\$/, '')
                .replace(/\)$/, '');

            // 2. Escape any raw asterisks if they aren't already
            // 3. Filter out empty strings
            this.cachedKeywords = cleaned.split('|')
                .map((k: string) => k.trim())
                .filter((k: string) => k.length > 0)
                .map((k: string) => k === '*' ? '\\*' : k)
                .join('|');

            return this.cachedKeywords!;
        }
        return "Given|When|Then|And|But";
    }

    public static isMatch(stepText: string, pattern: string, extensionPath: string): boolean {
        const keywords = this.getKeywords(extensionPath);

        // FIX: The regex must account for leading whitespace and 
        // ensure the keyword is a distinct word (using a lookahead or space)
        // We use (?: ) for non-capturing performance
        const keywordRegex = new RegExp(`^\\s*(?:${keywords})(?=\\s+|$)`, 'i');

        if (!keywordRegex.test(stepText.trimStart())) {
            // Log exactly what the regex was trying to do
            console.log(`DEBUG: [FAIL] Keyword check failed for: "${stepText.trim()}"`);
            return false;
        }

        // Strip the keyword
        const cleanStep = stepText.trim().replace(keywordRegex, '').trim();

        // Convert Cucumber expression placeholders to Regex
        const convertedPattern = pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\\{int\\\}/g, '\\d+')
            .replace(/\\\{float\\\}/g, '[\\d\\.]+')
            .replace(/\\\{word\\\}/g, '[^\\s]+')
            .replace(/\\\{string\\\}/g, '.*')
            .replace(/\\\{count:d\\\}/g, '\\d+');

        const finalRegex = new RegExp(`^${convertedPattern}$`, 'i');
        return finalRegex.test(cleanStep);
    }

    public static getFormattingKeywords(extensionPath: string) {
        const grammar = this.getGrammar(extensionPath);
        if (!grammar) return null;
        const clean = (raw: string) => raw.replace(/^\^\\s\*\(/, '').replace(/\)$/, '');
        return {
            features: new RegExp(`^\\s*(${clean(grammar.repository.feature_keyword.match.split(':')[0])}):`, 'i'),
            elements: new RegExp(`^\\s*(${clean(grammar.repository.feature_element_keyword.match.split(':')[0])}):`, 'i'),
            steps: new RegExp(`^\\s*(?:${this.getKeywords(extensionPath)})(\\s+|$)`, 'i')
        };
    }
}