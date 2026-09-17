import * as vscode from 'vscode';

const TEST_STEP_PATTERNS = ['**/*Steps.cs', '**/*.java', '**/*.py', '**/*.js', '**/*.ts'];

// Every suite's suiteSetup() calls this; only write once per test run so we don't
// trigger a full workspace re-index (via onDidChangeConfiguration) for every suite.
let applied = false;

export async function applyFixtureTestConfiguration(): Promise<void> {
    if (applied) return;
    applied = true;

    const config = vscode.workspace.getConfiguration('gherkinStepNavigator');

    await config.update('stepFilePattern', TEST_STEP_PATTERNS, vscode.ConfigurationTarget.Workspace);
    await config.update('caseSensitiveMatching', false, vscode.ConfigurationTarget.Workspace);
    await config.update('diagnostics.enabled', true, vscode.ConfigurationTarget.Workspace);
}

// Each suite opens fixture documents but never closes them; across ~8 suites these pile up
// as live open editors/documents for the whole test run, each getting re-diagnosed on every
// index/config event. Suites should call this in their suiteTeardown to keep memory bounded.
export async function closeAllEditors(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
}
