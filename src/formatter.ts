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
     * Main entry point for formatting. Now accepts keywords for internationalization support.
     */
    public static format(document: vscode.TextDocument, keywords: GherkinKeywords): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        let inTable = false;
        let tableRows: { line: number, cells: string[] }[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();

            if (!text) continue; // Skip empty lines

            // 1. Logic Switch: Tables vs. Standard Indentation
            if (text.startsWith('|')) {
                inTable = true;
                // Preserve raw text for table collection to maintain pipe structure
                const cells = line.text.split('|');
                tableRows.push({ line: i, cells });
            } else {
                // If we hit a non-table line, flush any collected table rows first
                if (inTable) {
                    edits.push(...this.alignTable(tableRows, document));
                    tableRows = [];
                    inTable = false;
                }

                // 2. Handle Indentation Logic using dynamic keywords
                const formattedLine = this.applyIndentation(line.text, keywords);
                if (formattedLine !== line.text) {
                    edits.push(vscode.TextEdit.replace(line.range, formattedLine));
                }
            }
        }

        // Final flush for tables at the end of a file
        if (inTable) {
            edits.push(...this.alignTable(tableRows, document));
        }

        return edits;
    }

    /**
     * Applies indentation levels based on Gherkin keyword types.
     */
    private static applyIndentation(originalText: string, keywords: GherkinKeywords): string {
        const text = originalText.trim();
        if (!text) return "";

        // Feature level (e.g., Feature:, Özellik:): 0 spaces
        if (keywords.features.test(text)) return text;

        // Scenario/Background/Rule level: 2 spaces
        if (keywords.elements.test(text)) return "  " + text;

        // Step level (Given, When, Then, etc.): 4 spaces
        if (keywords.steps.test(text)) return "    " + text;

        // DocStrings or fallback: 6 spaces
        if (text.startsWith('"""')) return "      " + text;

        return text;
    }

    /**
     * Aligns data table pipes vertically based on the maximum width of content in each column.
     */
    private static alignTable(rows: any[], document: vscode.TextDocument): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        if (rows.length === 0) return edits;

        const columnWidths: number[] = [];

        // Pass 1: Measure max width for each column
        rows.forEach((row) => {
            (row.cells as string[]).forEach((cell: string, idx: number) => {
                const trimmed = cell.trim();
                columnWidths[idx] = Math.max(columnWidths[idx] || 0, trimmed.length);
            });
        });

        // Pass 2: Reconstruct rows with uniform padding
        rows.forEach((row) => {
            const line = document.lineAt(row.line);
            const rawCells = row.cells as string[];

            // Remove empty strings from leading/trailing pipes
            const contentCells = rawCells.slice(1, -1);

            const formattedCells = contentCells.map((cell: string, i: number) => {
                const content = cell.trim();
                const colIndex = i + 1; // Offset for the leading pipe
                const targetWidth = columnWidths[colIndex];

                // Add standard padding: " Content(padded) "
                return ` ${content.padEnd(targetWidth)} `;
            });

            // Tables are indented to 6 spaces (same level as DocStrings)
            const alignedRow = "      |" + formattedCells.join('|') + "|";
            edits.push(vscode.TextEdit.replace(line.range, alignedRow));
        });

        return edits;
    }
}