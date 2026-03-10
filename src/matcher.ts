import * as fs from 'fs';
import * as path from 'path';

export interface GherkinFormattingRegexes {
    features: RegExp;
    elements: RegExp;
    steps: RegExp;
}

export class StepMatcher {
    private static cachedGrammar: any = null;
    private static cachedKeywords: string | null = null;

    /**
     * Loads the tmLanguage grammar from the extension installation to extract localized keywords.
     * Caches the result to avoid repeated disk I/O.
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
                try {
                    this.cachedGrammar = JSON.parse(fs.readFileSync(p, 'utf8'));
                    return this.cachedGrammar;
                } catch (e) { continue; }
            }
        }
        return null;
    }

    /**
     * Extracts and cleans the pipe-separated list of Gherkin step keywords (Given, When, etc.)
     * from the JSON grammar. Handles wildcard '*' symbols and trimming.
     */
    private static getKeywords(extensionPath: string): string {
        if (this.cachedKeywords !== null) return this.cachedKeywords;
        const grammar = this.getGrammar(extensionPath);
        if (grammar) {
            let rawMatch = grammar.repository.step_keyword.match;
            // Clean up regex symbols from grammar
            let cleaned = rawMatch.replace(/^\^\\s\*\(/, '').replace(/\)\s*\$/, '').replace(/\)$/, '');
            this.cachedKeywords = cleaned.split('|')
                .map((k: string) => k.trim())
                .filter((k: string) => k.length > 0)
                .map((k: string) => k === '*' ? '\\*' : k)
                .join('|');
            
            // Add StepDefinition to the returned string if it's not there
            if (!this.cachedKeywords!.includes('StepDefinition')) {
                this.cachedKeywords += '|StepDefinition';
            }
            return this.cachedKeywords!;
        }
        return "Given|When|Then|And|But";
    }

    /**
     * Determines if a line of Gherkin text matches a specific step definition pattern.
     * Supports Cucumber Expressions by converting placeholders into regex groups.
     */
    public static isMatch(stepText: string, pattern: string, extensionPath: string): boolean {
        const keywords = this.getKeywords(extensionPath);
        // Ensure the line actually starts with a valid Gherkin keyword
        const keywordRegex = new RegExp(`^\\s*(?:${keywords})(?=\\s+|$)`, 'i');
        if (!keywordRegex.test(stepText.trimStart())) return false;

        // Remove the keyword to match only the unique part of the step
        const cleanStep = stepText.trim().replace(keywordRegex, '').trim();

        // 1. Normalize C# verbatim quotes
        let convertedPattern = pattern.replace(/""/g, '"');

        // 2. Identify if it's a regex or a cucumber expression
        const isRegex = convertedPattern.includes('(') ||
            convertedPattern.includes('\\d') ||
            convertedPattern.startsWith('^');

        // 3. Escape literals if NOT a regex, but keep placeholders safe
        if (!isRegex) {
            convertedPattern = convertedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        // 4. Transform all known placeholders into regex groups
        convertedPattern = convertedPattern
            .replace(/\\\{int\\\}/g, '\\d+').replace(/\{int\}/g, '\\d+')
            .replace(/\\\{float\\\}/g, '[\\d\\.]+').replace(/\{float\}/g, '[\\d\\.]+')
            .replace(/\\\{word\\\}/g, '[^\\s]+').replace(/\{word\}/g, '[^\\s]+')
            .replace(/\\\{string\\\}/g, '.*').replace(/\{string\}/g, '.*')
            .replace(/\\\{count:d\\\}/g, '\\d+')
            .replace(/\\\{[\w:]+\\\}/g, '.*').replace(/\{[\w:]+\}/g, '.*');

        try {
            // Restore anchors but allow trailing wildcards for C# prefix patterns
            // If the pattern ends in a space, it likely expects a parameter.
            const suffix = convertedPattern.endsWith(' ') ? '.*' : '';
            const finalRegex = new RegExp(`^${convertedPattern}${suffix}$`, 'i');

            const result = finalRegex.test(cleanStep);

            return result;
        } catch (e) { return false; }
    }

    /**
     * Generates a set of regexes used by the GherkinFormatter.
     * Extracts localized "Feature", "Scenario", and Step keywords from grammar.
     */
    public static getFormattingKeywords(extensionPath: string): GherkinFormattingRegexes | null {
        const grammar = this.getGrammar(extensionPath);
        if (!grammar) return null;

        const clean = (raw: string) => {
            return raw
                .replace(/^\^/, '').replace(/\$$/, '')
                .replace(/^\\s\*\(/, '').replace(/\)\s*$/, '')
                .replace(/\):.*$/, '').replace(/\)$/, '');
        };

        try {
            const featureRaw = clean(grammar.repository.feature_keyword.match);
            const elementRaw = clean(grammar.repository.feature_element_keyword.match);
            const stepKeywords = this.getKeywords(extensionPath);

            return {
                features: new RegExp(`^(?:${featureRaw}):`, 'i'),
                elements: new RegExp(`^(?:${elementRaw}):`, 'i'),
                steps: new RegExp(`^(?:${stepKeywords})(?:\\s+|$)`, 'i')
            };
        } catch (e) { return null; }
    }

    /**
     * Returns a global regex to find step definitions in source files.
     * Matches patterns like @Given("pattern"), @When('pattern'), or [Given("pattern")].
     */
    public static getSourceRegex(extensionPath: string): RegExp {
        const keywords = this.getKeywords(extensionPath);
        // 1. (?:@|\\s*\\[) -> Matches either @ (Java/Python) or [ (C#)
        // 2. (?:${keywords}|StepDefinition) -> The Gherkin keyword
        // 3. [^"']*? -> Non-greedy skip that CANNOT skip past a quote
        // 4. [@$]? -> Matches C# verbatim (@) or interpolated ($) string markers
        return new RegExp(`(?:@|\\s*\\[)(?:${keywords}|StepDefinition)[^"']*?[@$]?(['"])(.*?)\\1`, 'gi');
    }
}