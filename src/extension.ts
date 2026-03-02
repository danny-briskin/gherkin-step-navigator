import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StepMatcher, StepDefinition } from './matcher';

/**
 * Extension activation entry point.
 * Registers a DefinitionProvider for 'gherkin' files to handle F12/Ctrl+Click navigation.
 */
export function activate(context: vscode.ExtensionContext) {
  const provider = vscode.languages.registerDefinitionProvider(
    { language: 'gherkin', scheme: 'file' },
    {
      async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
        // Get the text of the line where the cursor is currently positioned
        const lineText = document.lineAt(position.line).text;

        // Crawl the workspace and extension directory to find potential step definitions
        const stepDefinitions = await findStepDefinitions(context);

        // Iterate through found definitions to check if the current Gherkin line matches a code pattern
        for (const step of stepDefinitions) {
          if (StepMatcher.isMatch(lineText, step.pattern, context.extensionPath)) {
            // If a match is found, return the location (file path and line number) to VS Code
            return new vscode.Location(
              vscode.Uri.file(step.file),
              new vscode.Range(step.line, 0, step.line, 0)
            );
          }
        }
        return [];
      }
    }
  );
  context.subscriptions.push(provider);
}

/**
 * Searches for files matching defined patterns to extract step definition patterns.
 */
async function findStepDefinitions(context: vscode.ExtensionContext): Promise<StepDefinition[]> {
  let files: vscode.Uri[] = [];
  const config = vscode.workspace.getConfiguration('gherkinStepNavigator');

  // Retrieve user-defined glob patterns (e.g., "**/*.cs" or "**/*.js") from settings
  const patterns = config.get<string[]>('stepFilePattern') || ["**/*"];

  // Use VS Code's API to find files in the workspace, excluding node_modules
  for (const pattern of patterns) {
    const glob = pattern.includes('.') ? pattern : `${pattern.replace(/\/$/, '')}/**/*`;
    const matched = await vscode.workspace.findFiles(glob, '**/node_modules/**');
    files = files.concat(matched);
  }

  // Fallback: If no workspace files found (e.g., during tests), manually crawl the extension path
  if (files.length === 0) {
    const getAllFiles = (dir: string): string[] => {
      let results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        if (fullPath.includes('node_modules')) continue;
        if (fs.statSync(fullPath).isDirectory()) {
          results = results.concat(getAllFiles(fullPath));
        } else {
          results.push(fullPath);
        }
      }
      return results;
    };
    const all = getAllFiles(context.extensionPath);
    files = all.map(p => vscode.Uri.file(p));
  }

  const definitions: StepDefinition[] = [];
  const uniquePaths = [...new Set(files.map(f => f.fsPath))];

  // Process each unique file found
  for (const filePath of uniquePaths) {
    // Skip feature files and very large files for performance
    if (filePath.endsWith('.feature') || fs.statSync(filePath).size > 500000) continue;

    try {
      const buffer = fs.readFileSync(filePath);

      // Safety check: skip binary files by checking for null bytes
      if (buffer.includes(0)) continue;

      const lines = buffer.toString('utf8').split(/\r?\n/);
      lines.forEach((line, index) => {
        // Attempt to extract a regex pattern from each line of code
        const pattern = StepMatcher.extractRegex(line, context.extensionPath);
        if (pattern) {
          definitions.push({ pattern, line: index, file: filePath });
        }
      });
    } catch (err) { }
  }

  return definitions;
}

export function deactivate() { }