import * as vscode from 'vscode';

const TEST_STEP_PATTERNS = ['**/*Steps.cs', '**/*.java', '**/*.py'];

export async function applyFixtureTestConfiguration(): Promise<void> {
    const config = vscode.workspace.getConfiguration('gherkinStepNavigator');

    await config.update('stepFilePattern', TEST_STEP_PATTERNS, vscode.ConfigurationTarget.Workspace);
    await config.update('caseSensitiveMatching', false, vscode.ConfigurationTarget.Workspace);
    await config.update('diagnostics.enabled', true, vscode.ConfigurationTarget.Workspace);
}
