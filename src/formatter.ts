import * as vscode from 'vscode';

/**
 * Interface for pre-compiled regex patterns derived from the tmLanguage grammar.
 */
export interface GherkinKeywords {
    features: RegExp;
    elements: RegExp;
    steps: RegExp;
}

export class GherkinFormatter {
    /**
     * Main entry point for formatting Gherkin files.
     * Handles indentation and table alignment using localized keywords.
     */
    public static format(document: vscode.TextDocument, keywords: GherkinKeywords): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        let inTable = false;
        let tableRows: { line: number, cells: string[] }[] = [];
        let tagBuffer: vscode.TextLine[] = [];

        // Iterate + 1 to handle EOF flush
        for (let i = 0; i <= document.lineCount; i++) {
            const line = i < document.lineCount ? document.lineAt(i) : null;
            const text = line?.text.trim() || "";

            // 1. Buffer Tags
            if (line && text.startsWith('@')) {
                tagBuffer.push(line);
                continue;
            }

            // 2. Buffer Tables
            if (line && text.startsWith('|')) {
                inTable = true;
                tableRows.push({ line: i, cells: line.text.split('|') });
                continue;
            }

            // 3. Flush Tags - We hit an Anchor (Feature/Scenario/Step) or End of File
            if (tagBuffer.length > 0 && (text || i === document.lineCount)) {
                const targetIndent = line ? this.getIndentationLevel(line.text, keywords) : "";

                tagBuffer.forEach(tagLine => {
                    const formattedTag = targetIndent + tagLine.text.trim();

                    // If they are exactly the same, no edit is created.
                    // In tests, if the input already matches the output, find() returns undefined.
                    if (formattedTag !== tagLine.text) {
                        edits.push(vscode.TextEdit.replace(tagLine.range, formattedTag));
                    } 
                });
                tagBuffer = [];
            }

            // 4. Flush Tables
            if (inTable && (!line || !text.startsWith('|'))) {
                edits.push(...this.alignTable(tableRows, document));
                tableRows = [];
                inTable = false;
            }

            // 5. Normal Line Indentation
            if (line && text) {
                const formattedLine = this.applyIndentation(line.text, keywords);
                if (formattedLine !== line.text) {
                    edits.push(vscode.TextEdit.replace(line.range, formattedLine));
                }
            }
        }
        return edits;
    }

    /**
     * Helper to determine what the indentation of the line SHOULD be, 
     * based on your existing logic.
     */
    private static getIndentationLevel(text: string, keywords: GherkinKeywords): string {
        const trimmed = text.trim();
        if (keywords.features.test(trimmed)) return "";
        if (keywords.elements.test(trimmed)) return "  ";
        if (keywords.steps.test(trimmed)) return "    ";
        if (trimmed.startsWith('"""')) return "      ";
        return "    ";
    }

    /**
     * Calculates the appropriate indentation level based on Gherkin structure.
     */
    private static applyIndentation(originalText: string, keywords: GherkinKeywords): string {
        const text = originalText.trim();

        // 0 spaces: Feature level
        if (keywords.features.test(text)) return text;

        // 2 spaces: Scenarios, Rules, Backgrounds
        if (keywords.elements.test(text)) return "  " + text;

        // 4 spaces: Steps (Given, When, Then, And, But)
        if (keywords.steps.test(text)) return "    " + text;

        // 6 spaces: DocString blocks (""")
        if (text.startsWith('"""')) return "      " + text;

        return "    " + text;
    }

    /**
     * Aligns data table pipes vertically.
     * Uses a two-pass approach:
     * 1. Measure the maximum width required for each column across all rows.
     * 2. Pad each cell and reconstruct the row string with consistent vertical pipes.
     */
    private static alignTable(rows: any[], document: vscode.TextDocument): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const columnWidths: number[] = [];

        // Pass 1: Measure max widths per column
        rows.forEach((row) => {
            (row.cells as string[]).forEach((cell: string, idx: number) => {
                // Skip the outer segments of the split (before first pipe and after last)
                if (idx === 0 || idx === row.cells.length - 1) return;
                columnWidths[idx] = Math.max(columnWidths[idx] || 0, cell.trim().length);
            });
        });

        // Pass 2: Reconstruct and pad rows to 6-space indentation
        rows.forEach((row) => {
            const line = document.lineAt(row.line);
            const contentCells = (row.cells as string[]).slice(1, -1);
            const formatted = contentCells.map((cell, i) => {
                const colIndex = i + 1;
                return ` ${cell.trim().padEnd(columnWidths[colIndex])} `;
            });
            edits.push(vscode.TextEdit.replace(line.range, "      |" + formatted.join('|') + "|"));
        });
        return edits;
    }
}