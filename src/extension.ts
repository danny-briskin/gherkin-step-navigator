import * as path from 'path';
import * as vscode from 'vscode';
import { DEFAULT_INDENT, GherkinFormatter } from './formatter';
import { StepMatcher } from './matcher';

/**
 * In-memory cache to store step definitions for instant F12 lookups.
 * Maps step patterns (strings) to their physical locations in source code.
 */
let stepCache = new Map<string, vscode.Location[]>();
// DEBUG: Utility to log cache state
function logStepCacheState(context: string) {
  try {
    const entries = Array.from(stepCache.entries()).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v]);
    // Only log if running in test or debug mode
    if (process.env.NODE_ENV === 'test' || process.env.VSCODE_DEBUG_MODE || true) {
      // Always log for now
      // eslint-disable-next-line no-console
      console.log(`[stepCache][${context}]`, entries);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[stepCache][${context}] ERROR`, e);
  }
}
let indexingPromise: Promise<void> | null = null;
let diagnosticsEnabled = true;

interface DiagnosticsLifecycleState {
  disposed: boolean;
}

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
  diagnosticsEnabled = config.get<boolean>('diagnostics.enabled', true);
  const diagnostics = vscode.languages.createDiagnosticCollection('gherkinStepNavigator');
  context.subscriptions.push(diagnostics);

  // Load user patterns or fall back to defaults for Python, Java, and C#
  const patterns = config.get<string[]>('stepFilePattern') || ["**/*.py", "**/*.java", "**/*Steps.cs"];


  // Index workspace and update diagnostics synchronously
  indexingPromise = indexWorkspaceAndDiagnostics(extensionPath, patterns, diagnostics);

  // Setup File Watchers for each configured pattern
  patterns.forEach(pattern => {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(async uri => {
      await indexFileAndDiagnostics(uri, extensionPath, diagnostics);
    });
    watcher.onDidCreate(async uri => {
      await indexFileAndDiagnostics(uri, extensionPath, diagnostics);
    });
    watcher.onDidDelete(uri => {
      clearPathFromCache(uri);
      updateAllDiagnostics(extensionPath, diagnostics);
    });

    context.subscriptions.push(watcher);
  });

  // Explicitly handle folder deletions which file-specific watchers often miss
  const folderWatcher = vscode.workspace.createFileSystemWatcher('**/');
  folderWatcher.onDidDelete(uri => {
    clearPathFromCache(uri);
    updateAllDiagnostics(extensionPath, diagnostics);
  });
  context.subscriptions.push(folderWatcher);

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => {
    if (document.languageId === 'gherkin') {
      updateDiagnostics(document, extensionPath, diagnostics);
    }
  }));

  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
    if (event.document.languageId === 'gherkin') {
      updateDiagnostics(event.document, extensionPath, diagnostics);
    }
  }));

  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document => {
    diagnostics.delete(document.uri);
  }));

  // Register Language Features
  context.subscriptions.push(
    // Document Formatter
    vscode.languages.registerDocumentFormattingEditProvider('gherkin', {
      provideDocumentFormattingEdits(document) {
        const keywords = StepMatcher.getFormattingKeywords(extensionPath);
        const cfg = vscode.workspace.getConfiguration('gherkinStepNavigator.indent');
        const indent = {
          FEATURE: 0,
          ELEMENT: cfg.get<number>('scenario', DEFAULT_INDENT.ELEMENT),
          STEP: cfg.get<number>('step', DEFAULT_INDENT.STEP),
          TABLE: cfg.get<number>('table', DEFAULT_INDENT.TABLE),
          DOCSTRING: cfg.get<number>('docstring', DEFAULT_INDENT.DOCSTRING),
          TAG: cfg.get<number>('tag', DEFAULT_INDENT.TAG),
          COMMENT: cfg.get<number>('comment', DEFAULT_INDENT.COMMENT),
          TABLE_COMMENT: cfg.get<number>('tableComment', DEFAULT_INDENT.TABLE_COMMENT),
        };
        return keywords ? GherkinFormatter.format(document, keywords, indent) : [];
      }
    }),

    // Go to Definition (F12) Provider
    vscode.languages.registerDefinitionProvider('gherkin', {
      async provideDefinition(document, position) {
        // Ensure initial indexing is complete before searching
        if (indexingPromise) await indexingPromise;

        try {
          const lineText = document.lineAt(position.line).text;
          const results: vscode.Location[] = [];
          // Defensive: snapshot the cache to avoid mutation during iteration
          const cacheSnapshot = Array.from(stepCache.entries());
          for (const [pattern, locations] of cacheSnapshot) {
            if (!Array.isArray(locations)) continue; // Defensive: skip non-arrays
            if (StepMatcher.isMatch(lineText, pattern, extensionPath)) {
              results.push(...locations);
            }
          }
          return results;
        } catch (e) {
          // Defensive: never throw, always return []
          return [];
        }
      }
    })
  );

  // No longer needed: diagnostics are updated synchronously during indexing and file updates
}






function updateDiagnostics(document: vscode.TextDocument, extensionPath: string, diagnostics: vscode.DiagnosticCollection) {
  if (!diagnosticsEnabled) {
    diagnostics.delete(document.uri);
    return;
  }
  const docDiagnostics: vscode.Diagnostic[] = [];
  for (let line = 0; line < document.lineCount; line++) {
    const lineText = document.lineAt(line).text;
    if (!StepMatcher.isStepLine(lineText, extensionPath)) continue;
    let matchCount = 0;
    for (const [pattern, locations] of stepCache.entries()) {
      if (StepMatcher.isMatch(lineText, pattern, extensionPath)) {
        matchCount += locations.length;
      }
    }
    const firstNonWhitespace = lineText.search(/\S/);
    const startCharacter = firstNonWhitespace >= 0 ? firstNonWhitespace : 0;
    const range = new vscode.Range(line, startCharacter, line, lineText.length);
    if (matchCount === 0) {
      docDiagnostics.push(new vscode.Diagnostic(
        range,
        'No matching step definition found for this step.',
        vscode.DiagnosticSeverity.Warning
      ));
    } else if (matchCount > 1) {
      docDiagnostics.push(new vscode.Diagnostic(
        range,
        `Multiple step definitions match this step (${matchCount} matches).`,
        vscode.DiagnosticSeverity.Information
      ));
    }
  }
  diagnostics.set(document.uri, docDiagnostics);
}

function updateAllDiagnostics(extensionPath: string, diagnostics: vscode.DiagnosticCollection) {
  for (const document of vscode.workspace.textDocuments) {
    if (document.languageId === 'gherkin') {
      updateDiagnostics(document, extensionPath, diagnostics);
    }
  }
}

async function indexWorkspaceAndDiagnostics(extensionPath: string, patterns: string[], diagnostics: vscode.DiagnosticCollection) {
  for (const pattern of patterns) {
    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
    for (const file of files) {
      await indexFileAndDiagnostics(file, extensionPath, diagnostics);
    }
  }
  indexingPromise = null;
}

async function indexFileAndDiagnostics(uri: vscode.Uri, extensionPath: string, diagnostics: vscode.DiagnosticCollection) {
  await indexFile(uri, extensionPath);
  updateAllDiagnostics(extensionPath, diagnostics);
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
  logStepCacheState('after clearPathFromCache');

  try {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(content).toString('utf8');

    // Regex dynamically generated from the Gherkin grammar
    const stepDefRegex = StepMatcher.getSourceRegex(extensionPath);

    let match;
    while ((match = stepDefRegex.exec(text)) !== null) {
      // match[2] is the pattern inside the quotes
      const pattern = match[2] || match[1];

      if (pattern) {
        // match.index points to the start of the whole match (e.g., the '[' or '@')
        // We find the specific start of the pattern (match[2]) within the whole match
        const patternStartOffset = match[0].indexOf(pattern);
        const totalOffset = match.index + patternStartOffset;

        const lines = text.substring(0, totalOffset).split(/\r?\n/);
        const lineNum = lines.length - 1;
        const charNum = lines[lineNum].length;

        const pos = new vscode.Position(lineNum, charNum);
        let existing = stepCache.get(pattern);
        if (!Array.isArray(existing)) existing = [];
        stepCache.set(pattern, [...existing, new vscode.Location(uri, pos)]);
        logStepCacheState(`set pattern: ${pattern}`);
      }
    }
  } catch (e) { }
}

/**
 * Purges the cache for a specific file or recursively for an entire directory tree.
 * Essential for keeping the index accurate after file/folder deletions or moves.
 */
function clearPathFromCache(uri: vscode.Uri) {
  const targetPath = normalizePath(uri.fsPath);
  const sep = path.sep.toLowerCase();

  for (const [pattern, locations] of stepCache.entries()) {
    if (!Array.isArray(locations)) {
      // eslint-disable-next-line no-console
      console.warn(`[stepCache] Non-array value for pattern '${pattern}':`, locations);
      stepCache.delete(pattern);
      continue;
    }
    const filtered = locations.filter(loc => {
      const locPath = normalizePath(loc.uri.fsPath);
      // Match exact files or files residing inside a deleted folder path
      const isExactMatch = locPath === targetPath;
      const isInsideFolder = locPath.startsWith(targetPath + sep);
      return !isExactMatch && !isInsideFolder;
    });
    if (Array.isArray(filtered) && filtered.length === 0) {
      stepCache.delete(pattern);
    } else if (Array.isArray(filtered)) {
      stepCache.set(pattern, filtered);
      logStepCacheState(`filtered pattern: ${pattern}`);
    }
  }
  logStepCacheState('after clearPathFromCache loop');
}