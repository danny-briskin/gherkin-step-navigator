import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

test('Java Integration: Should find @Given in .java files', async () => {
    const extension = vscode.extensions.getExtension('DannyBriskin.gherkin-step-navigator');
    await extension?.activate();
    const fixturePath = path.join(extension!.extensionPath, 'out', 'test', 'fixtures');
    const uri = vscode.Uri.file(path.join(fixturePath, 'java_test.feature'));

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);

    // Wait for the definition provider to return a result (poll up to 5s)
    const pos = new vscode.Position(2, 10);
    let locs: vscode.Location[] | undefined;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        locs = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider', uri, pos
        );
        if (locs && locs.length > 0) break;
        await new Promise(res => setTimeout(res, 100));
    }

    assert.ok(locs && locs.length > 0, "Java step definition not found");
    assert.ok(locs[0].uri.fsPath.endsWith('.java'));
});