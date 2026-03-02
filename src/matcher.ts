import * as fs from 'fs';
import * as path from 'path';

/**
 * Structure representing a found step definition in the source code.
 */
export interface StepDefinition {
    pattern: string; // The regex or string pattern inside [Given("...")] or @given("...")
    line: number;    // Line number in the source file
    file: string;    // Full path to the source file
}

export class StepMatcher {
    // Static cache to prevent re-parsing the Gherkin grammar file on every check
    private static cachedKeywords: string | null = null;
    private static cachedGrammar: any = null;

    /**
     * Loads the grammar file once and caches the JSON object.
     */
    private static getGrammar(extensionPath: string): any {
        if (this.cachedGrammar) return this.cachedGrammar;

        const possiblePaths = [
            path.join(extensionPath, 'syntaxes', 'feature.tmLanguage.json'),
            path.join(extensionPath, '..', 'syntaxes', 'feature.tmLanguage.json'),
            path.join(__dirname, '..', 'syntaxes', 'feature.tmLanguage.json')
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
     * Extracts keywords for the Step Matcher. 
     * Fixed to remove trailing parentheses and escaped characters that cause SyntaxErrors.
     */
    private static getKeywords(extensionPath: string): string {
        if (this.cachedKeywords !== null) return this.cachedKeywords;

        try {
            const grammar = this.getGrammar(extensionPath);
            if (grammar) {
                let rawMatch = grammar.repository.step_keyword.match;

                // Clean the regex: Remove anchors and the outer-most capture group
                // This prevents the "Unmatched ')'" error when we wrap it later
                let cleaned = rawMatch
                    .replace(/^\^\\s\*\(/, '')
                    .replace(/\)\s*\$/, '')
                    .replace(/\)$/, ''); // Safety for trailing paren

                // Split, trim, and rejoin to ensure no weird whitespace issues
                this.cachedKeywords = cleaned.split('|')
                    .map((k: string) => k.trim())
                    .filter((k: string) => k.length > 0)
                    .join('|');

                return this.cachedKeywords!;
            }
        } catch (e) {
            console.error("Failed to load grammar keywords, falling back to English defaults.");
        }

        // Fallback so tests don't fail just because the JSON is missing
        return "Given|When|Then|And|But|\\*";
    }

    /**
     * Specifically for the Formatter: Returns cleaned regex for each indentation level.
     */
    public static getFormattingKeywords(extensionPath: string) {
        const grammar = this.getGrammar(extensionPath);
        if (!grammar) return null;

        // Helper to strip the outer parentheses from the grammar match string
        const clean = (raw: string) => {
            // Removes the leading ^\\s*\( and the trailing \)
            return raw.replace(/^\^\\s\*\(/, '').replace(/\)$/, '');
        };

        return {
            // We wrap the cleaned strings in our own set of parentheses
            features: new RegExp(`^\\s*(${clean(grammar.repository.feature_keyword.match.split(':')[0])}):`, 'i'),
            elements: new RegExp(`^\\s*(${clean(grammar.repository.feature_element_keyword.match.split(':')[0])}):`, 'i'),
            // For steps, we use the already cleaned keywords from getKeywords()
            steps: new RegExp(`^\\s*(?:${this.getKeywords(extensionPath)})(\\s+|$)`, 'i')
        };
    }

    /**
     * Compares a line of Gherkin text against an extracted code pattern.
     */
    public static isMatch(stepText: string, pattern: string, extensionPath: string): boolean {
        try {
            const keywords = this.getKeywords(extensionPath);

            // Build regex to identify and strip the Gherkin keyword
            const keywordRegex = new RegExp(`^\\s*(?:${keywords})\\s+`, 'i');
            if (!keywordRegex.test(stepText)) return false;

            const cleanStep = stepText.replace(keywordRegex, '').trim();

            // Normalization for various languages/frameworks
            let convertedPattern = pattern
                .replace(/\{int\}/g, '\\d+')
                .replace(/\{float\}/g, '[\\d\\.]+')
                .replace(/\{word\}/g, '[^\\s]+')
                .replace(/\{string\}/g, '.*')
                .replace(/\{count:d\}/g, '\\d+');

            const regex = new RegExp(`^${convertedPattern}$`, 'i');
            return regex.test(cleanStep);
        } catch (e) {
            return false;
        }
    }
}