import * as vscode from 'vscode';
import * as path from 'path';
import { StepMatcher } from './matcher';
import { GherkinFormatter } from './formatter';

/**
 * In-memory cache to store step definitions for instant F12 lookups.
 * Maps step patterns (strings) to their physical locations in source code.
 */
let stepCache = new Map<string, vscode.Location[]>();
let indexingPromise: Promise<void> | null = null;

/**
 * Normalizes file paths for reliable Map lookups.
 * Converts to lowercase to handle Windows drive-letter case inconsistency.
 */
function normalizePath(fsPath: string): string {
  return path.normalize(fsPath).toLowerCase();
}

/**
 * Extension entry point. Sets up indexing, watchers, and language providers.
 */
export async function activate(context: vscode.ExtensionContext) {
  const extensionPath = context.extensionPath;
  const config = vscode.workspace.getConfiguration('gherkinStepNavigator');

  // Load user patterns or fall back to defaults for Python, Java, and C#
  const patterns = config.get<string[]>('stepFilePattern') || ["**/*.py", "**/*.java", "**/*Steps.cs"];

  // Start Background Indexing
  indexingPromise = indexWorkspace(extensionPath, patterns);

  // Setup File Watchers for each configured pattern
  patterns.forEach(pattern => {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(uri => indexFile(uri, extensionPath));
    watcher.onDidCreate(uri => indexFile(uri, extensionPath));
    watcher.onDidDelete(uri => clearPathFromCache(uri));

    context.subscriptions.push(watcher);
  });

  // Explicitly handle folder deletions which file-specific watchers often miss
  const folderWatcher = vscode.workspace.createFileSystemWatcher('**/');
  folderWatcher.onDidDelete(uri => clearPathFromCache(uri));
  context.subscriptions.push(folderWatcher);

  // Register Language Features
  context.subscriptions.push(
    // Document Formatter
    vscode.languages.registerDocumentFormattingEditProvider('gherkin', {
      provideDocumentFormattingEdits(document) {
        const keywords = StepMatcher.getFormattingKeywords(extensionPath);
        return keywords ? GherkinFormatter.format(document, keywords) : [];
      }
    }),

    // Go to Definition (F12) Provider
    vscode.languages.registerDefinitionProvider('gherkin', {
      async provideDefinition(document, position) {
        // Ensure initial indexing is complete before searching
        if (indexingPromise) await indexingPromise;

        const lineText = document.lineAt(position.line).text;
        const results: vscode.Location[] = [];

        // Scan the cache for patterns that match the current Gherkin step text
        for (const [pattern, locations] of stepCache.entries()) {
          if (StepMatcher.isMatch(lineText, pattern, extensionPath)) {
            results.push(...locations);
          }
        }
        return results.length > 0 ? results : null;
      }
    })
  );
}

/**
 * Scans the entire workspace using glob patterns to build the step definition index.
 */
async function indexWorkspace(extensionPath: string, patterns: string[]) {
  for (const pattern of patterns) {
    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
    for (const file of files) {
      await indexFile(file, extensionPath);
    }
  }
  indexingPromise = null;
}

/**
 * Parses a single source file to extract step definition patterns (e.g., @Given("...")).
 * Automatically updates the global stepCache.
 */
async function indexFile(uri: vscode.Uri, extensionPath: string) {
  if (!uri || !uri.fsPath) return;

  // Prevent duplicate entries if a file is modified
  clearPathFromCache(uri);

  try {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(content).toString('utf8');

    // Regex dynamically generated from the Gherkin grammar
    const stepDefRegex = StepMatcher.getSourceRegex(extensionPath);

    let match;
    while ((match = stepDefRegex.exec(text)) !== null) {
      const pattern = match[2] || match[1];
      if (pattern) {
        const lines = text.substring(0, match.index).split('\n');
        const pos = new vscode.Position(lines.length - 1, lines[lines.length - 1].length);

        const existing = stepCache.get(pattern) || [];
        stepCache.set(pattern, [...existing, new vscode.Location(uri, pos)]);
      }
    }
  } catch (e) {
    // Fail silently: file might be locked or inaccessible
  }
}

/**
 * Purges the cache for a specific file or recursively for an entire directory tree.
 * Essential for keeping the index accurate after file/folder deletions or moves.
 */
function clearPathFromCache(uri: vscode.Uri) {
  const targetPath = normalizePath(uri.fsPath);
  const sep = path.sep.toLowerCase();

  for (const [pattern, locations] of stepCache.entries()) {
    const filtered = locations.filter(loc => {
      const locPath = normalizePath(loc.uri.fsPath);

      // Match exact files or files residing inside a deleted folder path
      const isExactMatch = locPath === targetPath;
      const isInsideFolder = locPath.startsWith(targetPath + sep);

      return !isExactMatch && !isInsideFolder;
    });

    if (filtered.length === 0) {
      stepCache.delete(pattern);
    } else {
      stepCache.set(pattern, filtered);
    }
  }
}

export function deactivate() {
  stepCache.clear();
}