import * as fs from 'fs';
import * as path from 'path';

export class StepMatcher {
    private static cachedGrammar: any = null;
    private static cachedKeywords: string | null = null;

    /**
     * Loads the tmLanguage grammar to extract localized keywords.
     */
    private static getGrammar(extensionPath: string | undefined): any {
        if (this.cachedGrammar) return this.cachedGrammar;

        const possiblePaths = [
            ...(extensionPath ? [path.join(extensionPath, 'syntaxes', 'feature.tmLanguage.json')] : []),
            path.join(__dirname, '..', '..', 'syntaxes', 'feature.tmLanguage.json'),
            path.join(__dirname, '..', 'syntaxes', 'feature.tmLanguage.json'),
            path.resolve(__dirname, '../../syntaxes/feature.tmLanguage.json')
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                this.cachedGrammar = JSON.parse(fs.readFileSync(p, 'utf8'));
                return this.cachedGrammar;
            }
        }
        return null;
    }

    /**
     * Retrieves and cleans Gherkin keywords (Given, When, etc.) from the grammar.
     */
    private static getKeywords(extensionPath: string): string {
        if (this.cachedKeywords !== null) return this.cachedKeywords;

        const grammar = this.getGrammar(extensionPath);
        if (grammar) {
            let rawMatch = grammar.repository.step_keyword.match;

            let cleaned = rawMatch
                .replace(/^\^\\s\*\(/, '')
                .replace(/\)\s*\$/, '')
                .replace(/\)$/, '');

            this.cachedKeywords = cleaned.split('|')
                .map((k: string) => k.trim())
                .filter((k: string) => k.length > 0)
                .map((k: string) => k === '*' ? '\\*' : k)
                .join('|');

            return this.cachedKeywords!;
        }
        return "Given|When|Then|And|But";
    }

    /**
     * Matches a Gherkin step line against a stored step definition pattern.
     */
    public static isMatch(stepText: string, pattern: string, extensionPath: string): boolean {
        const keywords = this.getKeywords(extensionPath);

        // Match keyword at start of line with word boundary check
        const keywordRegex = new RegExp(`^\\s*(?:${keywords})(?=\\s+|$)`, 'i');

        if (!keywordRegex.test(stepText.trimStart())) {
            return false;
        }

        const cleanStep = stepText.trim().replace(keywordRegex, '').trim();

        // Convert Cucumber-style expression placeholders to valid Regular Expressions
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

    /**
     * Generates regex objects for the Gherkin formatter.
     */
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

    /**
     * Returns a regex to find step definitions in source code (e.g., @Given("pattern")).
     */
    public static getSourceRegex(extensionPath: string): RegExp {
        const keywords = this.getKeywords(extensionPath);
        // Captures content inside quotes preceded by a Gherkin keyword decorator
        const decoratorPattern = `(?:@|\\[)(?:${keywords}).*?(['"])(.*?)\\1`;
        return new RegExp(decoratorPattern, 'gi');
    }
}