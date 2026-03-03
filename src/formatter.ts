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

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();
            if (!text) continue;

            // Detect Data Table lines (pipes)
            if (text.startsWith('|')) {
                inTable = true;
                tableRows.push({ line: i, cells: line.text.split('|') });
            } else {
                // Flush collected table rows if we reach the end of a table block
                if (inTable) {
                    edits.push(...this.alignTable(tableRows, document));
                    tableRows = [];
                    inTable = false;
                }

                // Apply standard indentation logic
                const formattedLine = this.applyIndentation(line.text, keywords);
                if (formattedLine !== line.text) {
                    edits.push(vscode.TextEdit.replace(line.range, formattedLine));
                }
            }
        }

        // Final flush if the file ends with a table
        if (inTable) {
            edits.push(...this.alignTable(tableRows, document));
        }

        return edits;
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