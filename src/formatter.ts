import * as vscode from 'vscode';

/**
 * Interface defining the regular expressions used to identify Gherkin keywords
 * based on the language of the document.
 */
export interface GherkinKeywords {
    features: RegExp;
    elements: RegExp;
    steps: RegExp;
}

/**
 * Represents metadata for a single line in a Gherkin document,
 * used to calculate final formatting edits.
 */
interface LineContext {
    lineIndex: number;
    text: string;
    type: 'feature' | 'element' | 'step' | 'table' | 'comment' | 'table-comment' | 'tag' | 'empty';
    indent: number;
}

/**
 * Default indentation levels for different Gherkin elements.
 */
const INDENT = {
    FEATURE: 0,
    ELEMENT: 2,
    STEP: 4,
    DOCSTRING: 6,
    TABLE: 6,
    COMMENT: 4,
    TAG: 4,
    TABLE_COMMENT: 6,
};

export class GherkinFormatter {

    /**
     * Entry point for formatting a Gherkin document.
     * @param document The VS Code TextDocument to format.
     * @param keywords The language-specific keywords to use for identification.
     * @returns An array of TextEdits to be applied to the document.
     */
    public static format(document: vscode.TextDocument, keywords: GherkinKeywords): vscode.TextEdit[] {
        // 1. Initial pass to identify the type of every line
        const contextMap = this.scanDocument(document, keywords);

        // 2. Adjust indentation based on document structure (e.g., tags anchoring to elements)
        this.resolveIndentation(contextMap);

        // 3. Align table pipes and handle table-specific comments
        this.normalizeTables(contextMap);

        // 4. Transform metadata into VS Code TextEdit instructions
        return this.generateEdits(document, contextMap);
    }

    /**
     * Iterates through the document to create a metadata map of all lines.
     */
    private static scanDocument(document: vscode.TextDocument, keywords: GherkinKeywords): LineContext[] {
        return Array.from({ length: document.lineCount }, (_, i) => {
            const rawLine = document.lineAt(i).text;
            const ctx = this.identifyLine(i, rawLine, keywords);
            // Default indent to 0 for empty lines, -1 (to be resolved) for others
            ctx.indent = ctx.type === 'empty' ? 0 : -1;
            return ctx;
        });
    }

    /**
     * Resolves the final indentation for every line. 
     * Uses a loop to ensure that "floating" elements like tags and comments stabilize
     * based on the indentation of the elements they anchor to.
     */
    private static resolveIndentation(contextMap: LineContext[]): void {
        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 0; i < contextMap.length; i++) {
                const current = contextMap[i];
                if (current.type === 'empty') continue;

                let newIndent: number;

                if (current.type === 'table' || current.type === 'table-comment') {
                    newIndent = INDENT.TABLE;
                } else if (current.type === 'element') {
                    newIndent = INDENT.ELEMENT;
                } else if (current.type === 'tag') {
                    // Tags should inherit the indentation of the next meaningful line (Scenario/Feature)
                    const next = contextMap.slice(i + 1).find(lc => lc.type !== 'empty');
                    newIndent = next ? next.indent : 0;
                } else if (current.type === 'comment') {
                    // Standard comments use context-aware lookahead logic
                    newIndent = this.calculateCommentIndent(contextMap, i);
                } else {
                    newIndent = INDENT[current.type.toUpperCase() as keyof typeof INDENT] || 0;
                }

                if (current.indent !== newIndent) {
                    current.indent = newIndent;
                    changed = true; // Continue looping until all indents are stable
                }
            }
        }
    }

    /**
     * Determines the indentation of a standard comment.
     * Anchors to the next meaningful line unless separated by an empty line (isolation).
     */
    private static calculateCommentIndent(contextMap: LineContext[], i: number): number {
        // Find the next line that isn't empty or a comment
        const nextMeaningful = contextMap.slice(i + 1).find(lc =>
            lc.type !== 'empty' &&
            lc.type !== 'comment' &&
            lc.type !== 'table-comment'
        );

        // Determine if there is an empty line between the comment and the next block
        const nextIdx = nextMeaningful ? contextMap.indexOf(nextMeaningful) : contextMap.length;
        const isIsolated = contextMap.slice(i + 1, nextIdx).some(lc => lc.type === 'empty');

        // If not isolated, "cling" to the indentation of the following block
        if (nextMeaningful && !isIsolated) {
            return nextMeaningful.indent;
        }

        // Default to 4 spaces for isolated comments or trailing comments
        return INDENT.COMMENT;
    }

    /**
     * Identifies contiguous blocks of tables/table-comments and aligns them.
     */
    private static normalizeTables(contextMap: LineContext[]): void {
        let i = 0;
        while (i < contextMap.length) {
            if (contextMap[i].type === 'table' || contextMap[i].type === 'table-comment') {
                const blockIndices = this.getTableBlockIndices(contextMap, i);
                this.alignTableBlock(contextMap, blockIndices);
                i += blockIndices.length; // Skip the rest of the processed block
            } else {
                i++;
            }
        }
    }

    /**
     * Returns the indices of all lines belonging to the same table block.
     */
    private static getTableBlockIndices(contextMap: LineContext[], start: number): number[] {
        const indices: number[] = [];
        let j = start;
        while (j < contextMap.length && (contextMap[j].type === 'table' || contextMap[j].type === 'table-comment')) {
            indices.push(j);
            j++;
        }
        return indices;
    }

    /**
     * Aligns table columns by calculating the maximum width for each column in the block.
     */
    private static alignTableBlock(contextMap: LineContext[], indices: number[]): void {
        const columnWidths: number[] = [];

        // Pass 1: Measure maximum width for each column
        indices.filter(idx => contextMap[idx].type === 'table').forEach(idx => {
            contextMap[idx].text.split('|').map(c => c.trim()).forEach((cell, colIdx) => {
                columnWidths[colIdx] = Math.max(columnWidths[colIdx] || 0, cell.length);
            });
        });

        // Pass 2: Apply padding and reconstruction
        indices.forEach(idx => {
            const ctx = contextMap[idx];
            if (ctx.type === 'table') {
                ctx.text = ctx.text.split('|')
                    .map((c, colIdx) => ` ${c.trim().padEnd(columnWidths[colIdx])} `)
                    .join('|')
                    .trim();
            } else if (ctx.type === 'table-comment') {
                // Table comments are preserved as-is but shifted to table indentation
                ctx.text = ' '.repeat(INDENT.TABLE_COMMENT) + ctx.text.trimStart();
            }
        });
    }

    /**
     * Generates VS Code TextEdits by comparing formatted text against the original document.
     */
    private static generateEdits(document: vscode.TextDocument, contextMap: LineContext[]): vscode.TextEdit[] {
        return contextMap
            .map(ctx => {
                const originalLine = document.lineAt(ctx.lineIndex);

                // For empty lines, ensure they are reduced to truly zero-length strings (remove trailing whitespace)
                if (ctx.type === 'empty') {
                    return originalLine.text.length > 0
                        ? vscode.TextEdit.replace(originalLine.range, '')
                        : null;
                }

                // Construct the formatted line using calculated indentation
                const formatted = " ".repeat(ctx.indent) + (ctx.type === 'table' ? ctx.text.trimEnd() : ctx.text.trim());

                // Only generate an edit if the formatted line differs from the original
                return formatted !== originalLine.text
                    ? vscode.TextEdit.replace(originalLine.range, formatted)
                    : null;
            })
            .filter((edit): edit is vscode.TextEdit => edit !== null);
    }

    /**
     * Uses regex and character matching to classify a line of text.
     */
    private static identifyLine(index: number, text: string, keywords: GherkinKeywords): LineContext {
        // 1. Identify whitespace-only lines
        if (/^\s*$/.test(text)) {
            return { lineIndex: index, text: '', type: 'empty', indent: 0 };
        }

        const trimmed = text.trim();

        // 2. Identify Tables
        if (trimmed.startsWith('|')) return { lineIndex: index, text, type: 'table', indent: INDENT.TABLE };

        // 3. Identify Comments (distinguish between standard and table-internal)
        if (trimmed.startsWith('#')) {
            return trimmed.includes('|')
                ? { lineIndex: index, text, type: 'table-comment', indent: INDENT.TABLE }
                : { lineIndex: index, text, type: 'comment', indent: INDENT.COMMENT };
        }

        // 4. Identify Tags
        if (trimmed.startsWith('@')) return { lineIndex: index, text, type: 'tag', indent: INDENT.TAG };

        // 5. Identify Features, Scenarios, and Steps using provided Gherkin grammar
        if (keywords.features.test(trimmed)) return { lineIndex: index, text, type: 'feature', indent: INDENT.FEATURE };
        if (keywords.elements.test(trimmed)) return { lineIndex: index, text, type: 'element', indent: INDENT.ELEMENT };
        if (keywords.steps.test(trimmed)) return { lineIndex: index, text, type: 'step', indent: INDENT.STEP };

        // 6. Default fallback for text that doesn't match standard patterns
        return { lineIndex: index, text, type: 'step', indent: INDENT.STEP };
    }
}