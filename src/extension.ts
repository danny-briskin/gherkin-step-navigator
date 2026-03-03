import * as vscode from 'vscode';
import * as path from 'path';
import { StepMatcher } from './matcher';
import { GherkinFormatter } from './formatter';

// In-memory cache to store step definitions for instant F12 lookups
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

  // 1. Initialize Keywords for Gherkin formatting
  const formattingKeywords = StepMatcher.getFormattingKeywords(extensionPath);

  // 2. Load User Configuration for Step Files
  const config = vscode.workspace.getConfiguration('gherkinStepNavigator');
  const patterns = config.get<string[]>('stepFilePattern') || ["**/*.py", "**/*.java", "**/*Steps.cs"];

  // 3. Start Background Indexing of the workspace
  indexingPromise = indexWorkspace(extensionPath, patterns);

  // 4. Setup File Watchers for each pattern (Updates cache on file changes)
  patterns.forEach(pattern => {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(uri => indexFile(uri, extensionPath));
    watcher.onDidCreate(uri => indexFile(uri, extensionPath));
    watcher.onDidDelete(uri => clearPathFromCache(uri));

    context.subscriptions.push(watcher);
  });

  // 5. Setup Folder Watcher
  // Explicitly handles folder deletions which file-specific watchers often miss.
  const folderWatcher = vscode.workspace.createFileSystemWatcher('**/');
  folderWatcher.onDidDelete(uri => clearPathFromCache(uri));
  context.subscriptions.push(folderWatcher);

  // 6. Register Language Providers
  context.subscriptions.push(
    // Document Formatter
    vscode.languages.registerDocumentFormattingEditProvider('gherkin', {
      provideDocumentFormattingEdits(document) {
        return formattingKeywords ? GherkinFormatter.format(document, formattingKeywords) : [];
      }
    }),

    // Go to Definition (F12) Provider
    vscode.languages.registerDefinitionProvider('gherkin', {
      async provideDefinition(document, position) {
        // Wait if indexing is still in progress
        if (indexingPromise) await indexingPromise;

        const lineText = document.lineAt(position.line).text;
        const results: vscode.Location[] = [];

        // Search the in-memory cache for matching step definitions
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
 * Scans the workspace using glob patterns to build the initial step definition cache.
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
 * Parses a single file and extracts step definition patterns into the cache.
 */
async function indexFile(uri: vscode.Uri, extensionPath: string) {
  if (!uri || !uri.fsPath) return;

  // Clear existing entries for this file before re-scanning to prevent duplicates
  clearPathFromCache(uri);

  try {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(content).toString('utf8');

    // Retrieve the source-code regex (e.g., @given) derived from the grammar
    const stepDefRegex = StepMatcher.getSourceRegex(extensionPath);

    let match;
    while ((match = stepDefRegex.exec(text)) !== null) {
      const pattern = match[2] || match[1];
      if (!pattern) continue;

      const lines = text.substring(0, match.index).split('\n');
      const pos = new vscode.Position(lines.length - 1, lines[lines.length - 1].length);

      const existing = stepCache.get(pattern) || [];
      stepCache.set(pattern, [...existing, new vscode.Location(uri, pos)]);
    }
  } catch (e) {
    // Fail silently: file might be locked or was deleted after the watcher event
  }
}

/**
 * Purges the cache for a specific file or an entire directory tree.
 */
function clearPathFromCache(uri: vscode.Uri) {
  const targetPath = normalizePath(uri.fsPath);
  const sep = path.sep.toLowerCase();

  for (const [pattern, locations] of stepCache.entries()) {
    const filtered = locations.filter(loc => {
      const locPath = normalizePath(loc.uri.fsPath);

      // Check for exact file match or if the file resides within a deleted folder
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