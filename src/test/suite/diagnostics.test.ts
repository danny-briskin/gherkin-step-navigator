import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

function getDiagnosticsForUri(uri: vscode.Uri): vscode.Diagnostic[] {
    return vscode.languages.getDiagnostics()
        .find(([diagnosticUri]) => diagnosticUri.toString() === uri.toString())?.[1] ?? [];
}

async function waitForDiagnostics(uri: vscode.Uri, predicate: (diagnostics: vscode.Diagnostic[]) => boolean, timeoutMs = 5000): Promise<vscode.Diagnostic[]> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const diagnostics = getDiagnosticsForUri(uri);
        if (predicate(diagnostics)) {
            return diagnostics;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return getDiagnosticsForUri(uri);
}

suite('Step Diagnostics Test Suite', () => {
    test('Should warn for unresolved steps', async () => {
        const extension = vscode.extensions.getExtension('DannyBriskin.gherkin-step-navigator');
        await extension?.activate();
        const fixturePath = path.join(extension!.extensionPath, 'out', 'test', 'fixtures');
        const uri = vscode.Uri.file(path.join(fixturePath, 'unresolved.feature'));

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        const diagnostics = await waitForDiagnostics(uri, items => items.some(d => d.severity === vscode.DiagnosticSeverity.Warning));
        const warning = diagnostics.find(d => d.severity === vscode.DiagnosticSeverity.Warning);

        assert.ok(warning, 'Expected an unresolved-step warning diagnostic');
        assert.strictEqual(warning?.message, 'No matching step definition found for this step.');
        assert.strictEqual(warning?.range.start.line, 2, 'The unresolved step should be on line 2');
    });

    test('Should flag ambiguous step matches', async () => {
        const extension = vscode.extensions.getExtension('DannyBriskin.gherkin-step-navigator');
        await extension?.activate();
        const fixturePath = path.join(extension!.extensionPath, 'out', 'test', 'fixtures');
        const uri = vscode.Uri.file(path.join(fixturePath, 'ambiguous.feature'));

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        const diagnostics = await waitForDiagnostics(uri, items => items.some(d => d.severity === vscode.DiagnosticSeverity.Information));
        const info = diagnostics.find(d => d.severity === vscode.DiagnosticSeverity.Information);

        assert.ok(info, 'Expected an ambiguous-step info diagnostic');
        assert.strictEqual(info?.message, 'Multiple step definitions match this step (2 matches).');
        assert.strictEqual(info?.range.start.line, 2, 'The ambiguous step should be on line 2');
    });
});