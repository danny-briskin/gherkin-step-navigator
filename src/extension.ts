import * as vscode from 'vscode';
import * as path from 'path';
import { StepMatcher } from './matcher';
import { GherkinFormatter, GherkinKeywords } from './formatter';

/**
 * Main activation entry point for the Gherkin Step Navigator extension.
 */
export function activate(context: vscode.ExtensionContext) {
  const extensionPath = context.extensionPath;

  // 1. Initialize Keywords for Internationalization
  // We retrieve the cleaned regex objects from the Matcher, which parses the tmLanguage file
  const formattingKeywords = StepMatcher.getFormattingKeywords(extensionPath);

  if (!formattingKeywords) {
    vscode.window.showErrorMessage("Gherkin Step Navigator: Failed to load grammar keywords.");
    return;
  }

  // 2. Register the Document Formatting Provider
  // This allows VS Code to trigger our formatter on Save or via Shift+Alt+F
  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider('gherkin', {
    provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
      // We pass the compiled GherkinKeywords to the formatter to handle multi-language indentation
      return GherkinFormatter.format(document, formattingKeywords);
    }
  });

  // 3. Register Definition Provider (F12 / Go to Definition)
  // This uses the StepMatcher to link .feature files to source code
  const definitionProvider = vscode.languages.registerDefinitionProvider('gherkin', {
    async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
      const lineText = document.lineAt(position.line).text;
      const extensionPath = context.extensionPath;

      // 1. Find all potential step definition files in the workspace
      const files = await vscode.workspace.findFiles('**/*.{py,java,cs,ts,js}');
      const locations: vscode.Location[] = [];

      for (const file of files) {
        const content = await vscode.workspace.openTextDocument(file);
        const text = content.getText();

        // 2. Scan for step definition patterns (@given, [Given], etc.)
        // This regex extracts the pattern inside the decorator/attribute
        const stepDefRegex = /(?:@|\[)(?:Given|When|Then|And|But).*?['"](.*?)['"]/gi;
        let match;

        while ((match = stepDefRegex.exec(text)) !== null) {
          const pattern = match[1];
          // 3. Use StepMatcher.isMatch to check for a link
          if (StepMatcher.isMatch(lineText, pattern, extensionPath)) {
            const pos = content.positionAt(match.index);
            locations.push(new vscode.Location(file, pos));
          }
        }
      }
      return locations;
    }
  });

  // Add providers to subscriptions to ensure they are cleaned up on deactivation
  context.subscriptions.push(formattingProvider, definitionProvider);
}

/**
 * Cleanup logic when the extension is disabled.
 */
export function deactivate() { }