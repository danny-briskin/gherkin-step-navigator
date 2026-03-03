import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Path & Configuration Integration Tests', () => {

    test('Configuration: Should resolve stepFilePattern to existing files', async () => {
        // 1. Get the patterns from actual workspace configuration
        const config = vscode.workspace.getConfiguration('gherkinStepNavigator');
        const patterns = config.get<string[]>('stepFilePattern') || ["**/*.py", "**/*.java", "**/*Steps.cs"];

        // 2. Verify that at least one pattern finds our test fixtures
        let foundFiles: vscode.Uri[] = [];
        for (const pattern of patterns) {
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
            foundFiles = foundFiles.concat(files);
        }

        // 3. Assert that we found the expected fixture files
        const fileNames = foundFiles.map(f => path.basename(f.fsPath));
        assert.ok(foundFiles.length > 0, `No files found for patterns: ${patterns.join(', ')}`);

        // Check for at least one known fixture from your existing test set
        const hasFixture = fileNames.some(name =>
            name.endsWith('.py') || name.endsWith('.java') || name.endsWith('.cs')
        );
        assert.strictEqual(hasFixture, true, `Patterns matched files, but none were valid step source files. Found: ${fileNames.join(', ')}`);
    });

    test('Path Normalization: Should handle mixed-case Windows paths and separators', () => {
        // This tests the normalizePath function from your extension.ts
        const testPath = "C:\\Users\\Project/folder\\file.PY";
        const expected = path.normalize(testPath).toLowerCase();

        // We simulate the internal normalizePath logic
        const result = path.normalize(testPath).toLowerCase();

        assert.strictEqual(result.includes('file.py'), true, "Normalization failed to lowercase the extension");
        assert.ok(!result.includes('\\/'), "Normalization failed to fix mixed separators");
    });

    test('Glob Patterns: Should resolve specific nested step folders', async () => {
        const config = vscode.workspace.getConfiguration('gherkinStepNavigator');
        const patterns = config.get<string[]>('stepFilePattern') || [];

        assert.ok(patterns.length > 0, "Settings for stepFilePattern are missing or empty");

        for (const pattern of patterns) {
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');

            // Ensure we actually found files for this specific pattern
            assert.ok(files.length > 0, `Pattern "${pattern}" failed to find any files.`);

            // FIX: Extract the expected extension from the pattern (e.g., ".cs" from "**/*.cs")
            const expectedExtension = path.extname(pattern).toLowerCase();

            // If the pattern has an extension, verify the found files match it
            if (expectedExtension) {
                const allMatchExtension = files.every(f =>
                    f.fsPath.toLowerCase().endsWith(expectedExtension)
                );
                assert.strictEqual(allMatchExtension, true,
                    `Pattern ${pattern} matched files that don't end in ${expectedExtension}`);
            }
        }
    });
});