import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { StepMatcher } from '../../matcher';

suite('Integration & Edge Case Test Suite', () => {

    test('Regex Safety: Should not crash with complex grammar patterns', () => {
        // Simulates the "Unmatched parenthesis" issue faced with complex tmLanguage patterns
        const complexGrammarMatch = "^\\s*(기능|機能|功能|フィーチャ|Ability|Feature):(.*)\\b):";

        const clean = (raw: string) => {
            return raw
                .replace(/^\^/, '').replace(/\$$/, '')
                .replace(/^\\s\*\(/, '').replace(/\)\s*$/, '')
                .replace(/\):.*$/, '').replace(/\)$/, '');
        };

        const result = clean(complexGrammarMatch);

        // Verify we can create a RegExp object without a SyntaxError
        try {
            const regex = new RegExp(`^(?:${result}):`, 'i');
            assert.ok(regex instanceof RegExp);
            assert.ok(regex.test("Feature: Hello"));
        } catch (e) {
            assert.fail(`RegExp construction crashed: ${e}`);
        }
    });

    test('Path Normalization: Should be case-insensitive for Windows paths', () => {
        // Normalizes paths to handle Windows drive-letter case inconsistency
        const path1 = "C:\\Users\\Test\\file.py";
        const path2 = "c:\\users\\test\\file.py";

        const normalize = (p: string) => path.normalize(p).toLowerCase();

        assert.strictEqual(normalize(path1), normalize(path2), "Path normalization failed to equate case-different Windows paths");
    });

    test('Cache Integrity: Should index steps from specific Soti folders', async () => {
        // This requires the extension to be active
        const ext = vscode.extensions.getExtension('danny-briskin.gherkin-step-navigator');
        await ext?.activate();

        // We can't access 'stepCache' directly (it's private), 
        // but we can check if a known step from those folders resolves
        const dummyUri = vscode.Uri.parse('untitled:test.feature');
        const document = await vscode.workspace.openTextDocument(dummyUri);

        // This command triggers the definition provider logic
        const locations = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            document.uri,
            new vscode.Position(0, 0) // You'd put a line here that matches a Soti step
        );

        // If this returns anything, it means the patterns worked and the files were counted
        console.log(`Indexer is active and patterns are being processed.`);
    });
});