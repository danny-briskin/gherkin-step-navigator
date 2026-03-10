import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

test('Java Integration: Should find @Given in .java files', async () => {
    const extension = vscode.extensions.getExtension('DannyBriskin.gherkin-step-navigator');
    const fixturePath = path.join(extension!.extensionPath, 'out', 'test', 'fixtures');
    const uri = vscode.Uri.file(path.join(fixturePath, 'java_test.feature'));

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pos = new vscode.Position(2, 10);
    const locs = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeDefinitionProvider', uri, pos
    );

    assert.ok(locs && locs.length > 0, "Java step definition not found");
    assert.ok(locs[0].uri.fsPath.endsWith('.java'));
});