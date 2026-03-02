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
        if (this.cachedKeywords !== null) return this.cachedKeywords;

        try {
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

                const keywordPatterns: string[] = [
                    repo.step_keyword?.match,
                    repo.and_keyword?.match,
                    repo.when_keyword?.match,
                    repo.then_keyword?.match,
                    repo.given_keyword?.match
                ].filter(Boolean);

                const allWords = keywordPatterns.flatMap(pattern => {
                    const match = pattern.match(/\((.*)\)/);
                    if (!match) return [];
                    return match[1].split('|').map(k => {
                        return k.replace(/[\\^$*+?.()|[\]{}]/g, '').trim();
                    });
                });

                const uniqueKeywords = [...new Set(allWords)].filter(k => k.length > 0);

                this.cachedKeywords = uniqueKeywords
                    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join('|');

                return this.cachedKeywords;
            }
        } catch (err) {
            // Log errors to a dedicated channel if necessary, or fail silently
        }

        return "Given|When|Then|And|But|Angenommen|Étant donné|Et|Und";
    }

    public static extractRegex(line: string, extensionPath: string): string | null {
        try {
            const keywords = this.getKeywords(extensionPath);
            const allKeywords = `${keywords}|StepDefinition`;
            const pattern = `\\[\\s*(?:${allKeywords})\\s*\\(\\s*@?"(.*)"\\s*\\)\\s*\\]`;
            const regex = new RegExp(pattern, 'i');
            const match = line.match(regex);
            return match ? match[1] : null;
        } catch (e) {
            return null;
        }
    }

    public static isMatch(stepText: string, csharpPattern: string, extensionPath: string): boolean {
        try {
            const keywords = this.getKeywords(extensionPath);
            const keywordRegex = new RegExp(`^\\s*(?:${keywords})\\s+`, 'i');

            if (!keywordRegex.test(stepText)) return false;

            const cleanStep = stepText.replace(keywordRegex, '').trim();
            const cleanPattern = csharpPattern.replace(/""/g, '"').trim();
            const regex = new RegExp(`^${cleanPattern}$`, 'i');
            return regex.test(cleanStep);
        } catch (e) {
            return false;
        }
    }
}