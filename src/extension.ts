import * as vscode from 'vscode';
import * as fs from 'fs';
import { StepMatcher, StepDefinition } from './matcher';

/**
 * Entry point for the extension.
 * Activated when a Gherkin (.feature) file is opened.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Gherkin Step Navigator is now active.');

  // Register the "Go to Definition" provider for Gherkin files
  const provider = vscode.languages.registerDefinitionProvider(
    { language: 'gherkin', scheme: 'file' },
    {
      async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
      ): Promise<vscode.Definition | vscode.LocationLink[]> {

        const lineText = document.lineAt(position.line).text;

        // Pass context to allow StepMatcher to find the tmLanguage JSON
        const stepDefinitions = await findStepDefinitions(context);

        for (const step of stepDefinitions) {
          if (StepMatcher.isMatch(lineText, step.pattern, context.extensionPath)) {
            const targetUri = vscode.Uri.file(step.file);

            // Set the destination to the specific line in the C# file
            const targetRange = new vscode.Range(
              new vscode.Position(step.line, 0),
              new vscode.Position(step.line, 0)
            );

            return new vscode.Location(targetUri, targetRange);
          }
        }

        return [];
      }
    }
  );

  context.subscriptions.push(provider);
}

/**
 * Scans the workspace for C# files and extracts Step Definition patterns.
 */
async function findStepDefinitions(context: vscode.ExtensionContext): Promise<StepDefinition[]> {
  const definitions: StepDefinition[] = [];

  // Use VS Code API to find all C# files, excluding node_modules
  const files = await vscode.workspace.findFiles('**/*.cs', '**/node_modules/**');

  for (const file of files) {
    try {
      const content = fs.readFileSync(file.fsPath, 'utf8');
      const lines = content.split(/\r?\n/);

      lines.forEach((line, index) => {
        // Use the internationalized extraction logic from StepMatcher
        const pattern = StepMatcher.extractRegex(line, context.extensionPath);

        if (pattern) {
          definitions.push({
            pattern: pattern,
            line: index,
            file: file.fsPath
          });
        }
      });
    } catch (err) {
      console.error(`Failed to read file ${file.fsPath}:`, err);
    }
  }

  return definitions;
}

export function deactivate() { }