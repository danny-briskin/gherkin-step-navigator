import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Integration Tests', () => {
    test('F12 Go to Definition should find C# step', async function () {
        this.timeout(10000);

        const extension = vscode.extensions.getExtension('danny-briskin.gherkin-step-navigator');
        const workspacePath = path.join(extension!.extensionPath, 'out', 'test', 'fixtures');
        const featureUri = vscode.Uri.file(path.join(workspacePath, 'test.feature'));

        const document = await vscode.workspace.openTextDocument(featureUri);
        await vscode.window.showTextDocument(document);

        // Give the indexer more time to complete the manual scan
        await new Promise(resolve => setTimeout(resolve, 1000));

        const position = new vscode.Position(2, 15); // Ensure this line in test.feature is a valid step
        const locations = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            document.uri,
            position
        );

        assert.ok(locations && locations.length > 0, `Definition not found at ${position.line}. Indexer found 0 files.`);
    });
});