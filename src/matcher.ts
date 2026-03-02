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

    /**
     * Dynamically loads Gherkin keywords (Given, When, Then, etc.) in all supported languages
     * by parsing the extension's tmLanguage grammar file.
     */
    private static getKeywords(extensionPath: string): string {
        if (this.cachedKeywords !== null) return this.cachedKeywords;

        try {
            // Locate the grammar file within the extension directory
            const possiblePaths = [
                path.join(extensionPath, 'syntaxes', 'feature.tmLanguage.json'),
                path.join(extensionPath, '..', 'syntaxes', 'feature.tmLanguage.json'),
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

                // Collect regex patterns for all step types from the grammar
                const keywordPatterns: string[] = [
                    repo.step_keyword?.match,
                    repo.and_keyword?.match,
                    repo.when_keyword?.match,
                    repo.then_keyword?.match,
                    repo.given_keyword?.match
                ].filter(Boolean);

                // Extract individual words from the capture groups, stripping regex escape characters
                const allWords = keywordPatterns.flatMap(pattern => {
                    const match = pattern.match(/\((.*)\)/);
                    if (!match) return [];
                    return match[1].split('|').map(k => {
                        return k.replace(/[\\^$*+?.()|[\]{}]/g, '').trim();
                    });
                });

                // Deduplicate and escape keywords for use in a clean regex string
                const uniqueKeywords = [...new Set(allWords)].filter(k => k.length > 0);

                this.cachedKeywords = uniqueKeywords
                    .map(k => k.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'))
                    .join('|');

                return this.cachedKeywords;
            }
        } catch (err) { }

        // Minimalist fallback if grammar parsing fails
        return "Given|When|Then|And|But|Angenommen|Étant donné|Et|Und";
    }

    /**
     * Scans a line of code (C#, Java, Python, etc.) to extract the content of a step attribute.
     * Example: Finds "I have {int} apples" from @Given("I have {int} apples")
     */
    public static extractRegex(line: string, extensionPath: string): string | null {
        const trimmed = line.trim();

        // Fast exit: most BDD frameworks use @ (Java/Python) or [ (C#) attributes
        if (!trimmed.startsWith('@') && !trimmed.startsWith('[')) return null;

        try {
            const keywords = this.getKeywords(extensionPath);
            // Combine Gherkin keywords with common framework attributes
            const allKeywords = `${keywords}|StepDefinition|given|when|then|and|but`;

            /**
             * Universal Regex breakdown:
             * (?:@|\\s*\\[\\s*) -> Matches @ or [ (start of attribute)
             * (?:${allKeywords}) -> Matches the keyword
             * \\s*(?:\\(|\\s*=\\s*) -> Matches '(' or '=' (e.g., [Given = "regex"])
             * \\s*@?['"](.*)['"] -> Captures the content inside quotes (supports C# verbatim @ symbols)
             */
            const pattern = `(?:@|\\s*\\[\\s*)(?:${allKeywords})\\s*(?:\\(|\\s*=\\s*)\\s*@?['"](.*)['"]\\s*\\)?\\s*\\]?`;
            const regex = new RegExp(pattern, 'i');
            const match = trimmed.match(regex);

            if (match && match[1]) {
                // Secondary check to avoid matching the regex logic inside the extension itself
                if (match[1].includes('...")')) return null;
                return match[1];
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    /**
     * Compares a line of Gherkin text from a .feature file against an extracted code pattern.
     */
    public static isMatch(stepText: string, pattern: string, extensionPath: string): boolean {
        try {
            const keywords = this.getKeywords(extensionPath);

            // Build regex to identify and strip the Gherkin keyword from the start of the line
            const keywordRegex = new RegExp(`^\\s*(?:${keywords})\\s+`, 'i');
            if (!keywordRegex.test(stepText)) return false;

            // Remove keyword (e.g., "Given ") to get the core step text
            const cleanStep = stepText.replace(keywordRegex, '').trim();

            /**
             * NORMALIZATION:
             * Converts Cucumber Expressions (common in Java/JS) and Python formatters
             * into standard regex wildcards for comparison.
             */
            let convertedPattern = pattern
                .replace(/\{int\}/g, '\\d+')
                .replace(/\{float\}/g, '[\\d\\.]+')
                .replace(/\{word\}/g, '[^\\s]+')
                .replace(/\{string\}/g, '.*')
                .replace(/\{count:d\}/g, '\\d+'); // Behave (Python) specific

            // Create a strict case-insensitive regex to validate the match
            const regex = new RegExp(`^${convertedPattern}$`, 'i');
            return regex.test(cleanStep);
        } catch (e) {
            return false;
        }
    }
}