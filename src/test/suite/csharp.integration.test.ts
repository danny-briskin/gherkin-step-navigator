import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

suite('Extension Integration Tests', () => {
    test('F12 Go to Definition should find C# step', async function () {
        // Add this inside your test to see what the indexer sees
        const files = await vscode.workspace.findFiles('**/*.cs');

        const extension = vscode.extensions.getExtension('DannyBriskin.gherkin-step-navigator');
        const workspacePath = path.join(extension!.extensionPath, 'out', 'test', 'fixtures');
        const featureUri = vscode.Uri.file(path.join(workspacePath, 'csharp_test.feature'));

        const document = await vscode.workspace.openTextDocument(featureUri);
        await vscode.window.showTextDocument(document);

        // Give the indexer more time to complete the manual scan
        await new Promise(resolve => setTimeout(resolve, 1000));

        const position = new vscode.Position(2, 15); // Ensure this line in csharp.test.feature is a valid step
        const locations = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            document.uri,
            position
        );

        assert.ok(locations && locations.length > 0, `Definition not found at ${position.line}. Indexer found 0 files.`);
    });

    test('F12: Should resolve C# step with regex parameters', async function () {
        // Add this inside your test to see what the indexer sees
        const files = await vscode.workspace.findFiles('**/*.cs');
        
        const extension = vscode.extensions.getExtension('DannyBriskin.gherkin-step-navigator');
        const fixturePath = path.join(extension!.extensionPath, 'out', 'test', 'fixtures');
        const featureUri = vscode.Uri.file(path.join(fixturePath, 'csharp_test.feature'));

        const document = await vscode.workspace.openTextDocument(featureUri);
        await vscode.window.showTextDocument(document);

        // Give indexer time to breathe
        await new Promise(resolve => setTimeout(resolve, 1000));

        // CHANGE: Target Line 3 (the one with the "Admin" parameter)
        const position = new vscode.Position(3, 15);

        const locations = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            document.uri,
            position
        );

        assert.ok(locations && locations.length > 0,
            `Failed at line ${position.line}. Ensure this line in the .feature file matches a [Given/When/Then] in your .cs file.`);
    });
});