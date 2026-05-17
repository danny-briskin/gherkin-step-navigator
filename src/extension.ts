import * as path from 'path';
import * as vscode from 'vscode';
import { DEFAULT_INDENT, GherkinFormatter } from './formatter';
import { StepMatcher } from './matcher';

/**
 * In-memory cache to store step definitions for instant F12 lookups.
 * Maps step patterns (strings) to their physical locations in source code.
 */
let stepCache = new Map<string, vscode.Location[]>();
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

function logNonCriticalError(context: string, error: unknown) {
  console.error(`[gherkin-step-navigator] ${context}`, error);
}

function fireAndForget(task: Promise<void>, context: string) {
  task.catch(error => logNonCriticalError(context, error));
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
  const diagnosticsRefreshTimer = new Map<string, ReturnType<typeof setTimeout>>();
  const diagnosticsLifecycle: DiagnosticsLifecycleState = { disposed: false };
  context.subscriptions.push(new vscode.Disposable(() => {
    diagnosticsLifecycle.disposed = true;
    for (const timer of diagnosticsRefreshTimer.values()) {
      clearTimeout(timer);
    }
    diagnosticsRefreshTimer.clear();
  }));

  // Load user patterns or fall back to defaults for Python, Java, and C#
  const patterns = config.get<string[]>('stepFilePattern') || ["**/*.py", "**/*.java", "**/*Steps.cs"];

  // Start Background Indexing
  indexingPromise = indexWorkspace(extensionPath, patterns)
    .catch(error => {
      logNonCriticalError('background indexing failed', error);
    });

  // Setup File Watchers for each configured pattern
  patterns.forEach(pattern => {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(async uri => {
      if (diagnosticsLifecycle.disposed) return;
      try {
        // P0: diagnostics are refreshed inline within indexFile() for incremental updates
        await indexFile(uri, extensionPath, diagnostics, diagnosticsLifecycle);
        if (diagnosticsLifecycle.disposed) return;
      } catch (error) {
        logNonCriticalError('watcher onDidChange failed', error);
      }
    });
    watcher.onDidCreate(async uri => {
      if (diagnosticsLifecycle.disposed) return;
      try {
        // P0: diagnostics are refreshed inline within indexFile() for incremental updates
        await indexFile(uri, extensionPath, diagnostics, diagnosticsLifecycle);
        if (diagnosticsLifecycle.disposed) return;
      } catch (error) {
        logNonCriticalError('watcher onDidCreate failed', error);
      }
    });
    watcher.onDidDelete(uri => {
      if (diagnosticsLifecycle.disposed) return;
      clearPathFromCache(uri);
      fireAndForget(
        refreshAllOpenGherkinDiagnostics(extensionPath, diagnostics, diagnosticsLifecycle),
        'watcher onDidDelete refresh failed'
      );
    });

    context.subscriptions.push(watcher);
  });

  // Explicitly handle folder deletions which file-specific watchers often miss
  const folderWatcher = vscode.workspace.createFileSystemWatcher('**/');
  folderWatcher.onDidDelete(uri => {
    if (diagnosticsLifecycle.disposed) return;
    clearPathFromCache(uri);
    fireAndForget(
      refreshAllOpenGherkinDiagnostics(extensionPath, diagnostics, diagnosticsLifecycle),
      'folder watcher onDidDelete refresh failed'
    );
  });
  context.subscriptions.push(folderWatcher);

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => {
    if (diagnosticsLifecycle.disposed) return;
    if (document.languageId === 'gherkin') {
      queueDiagnosticsRefresh(document, extensionPath, diagnostics, diagnosticsRefreshTimer, diagnosticsLifecycle);
    }
  }));

  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
    if (diagnosticsLifecycle.disposed) return;
    if (event.document.languageId === 'gherkin') {
      queueDiagnosticsRefresh(event.document, extensionPath, diagnostics, diagnosticsRefreshTimer, diagnosticsLifecycle);
    }
  }));

  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document => {
    if (diagnosticsLifecycle.disposed) return;
    diagnostics.delete(document.uri);
    const key = document.uri.toString();
    const existing = diagnosticsRefreshTimer.get(key);
    if (existing) {
      clearTimeout(existing);
      diagnosticsRefreshTimer.delete(key);
    }
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
        try {
          const lineText = document.lineAt(position.line).text;

          // Fast path: use whatever is currently indexed to keep F12 responsive.
          let results = getMatchingLocations(lineText, extensionPath);

          // If still indexing and no hit yet, give indexing a short chance to catch up.
          if (results.length === 0 && indexingPromise) {
            await Promise.race([
              indexingPromise,
              new Promise(resolve => setTimeout(resolve, 1500))
            ]);
            results = getMatchingLocations(lineText, extensionPath);
          }

          return results.length > 0 ? results : null;
        } catch (error) {
          logNonCriticalError('definition provider failed', error);
          return null;
        }
      }
    })
  );

  fireAndForget(
    refreshAllOpenGherkinDiagnostics(extensionPath, diagnostics, diagnosticsLifecycle),
    'initial diagnostics refresh failed'
  );
}

function queueDiagnosticsRefresh(
  document: vscode.TextDocument,
  extensionPath: string,
  diagnostics: vscode.DiagnosticCollection,
  diagnosticsRefreshTimer: Map<string, ReturnType<typeof setTimeout>>,
  diagnosticsLifecycle: DiagnosticsLifecycleState
) {
  if (diagnosticsLifecycle.disposed) return;

  if (!diagnosticsEnabled) {
    diagnostics.delete(document.uri);
    return;
  }

  const key = document.uri.toString();
  const existing = diagnosticsRefreshTimer.get(key);
  if (existing) clearTimeout(existing);

  diagnosticsRefreshTimer.set(
    key,
    setTimeout(async () => {
      if (diagnosticsLifecycle.disposed) return;
      diagnosticsRefreshTimer.delete(key);
      try {
        await refreshDiagnostics(document, extensionPath, diagnostics, diagnosticsLifecycle);
      } catch (error) {
        logNonCriticalError('queued diagnostics refresh failed', error);
      }
    }, 200)
  );
}

async function refreshAllOpenGherkinDiagnostics(
  extensionPath: string,
  diagnostics: vscode.DiagnosticCollection,
  diagnosticsLifecycle: DiagnosticsLifecycleState
) {
  if (diagnosticsLifecycle.disposed) return;

  if (!diagnosticsEnabled) {
    diagnostics.clear();
    return;
  }

  for (const document of vscode.workspace.textDocuments) {
    if (diagnosticsLifecycle.disposed) return;
    if (document.languageId === 'gherkin') {
      await refreshDiagnostics(document, extensionPath, diagnostics, diagnosticsLifecycle);
      if (diagnosticsLifecycle.disposed) return;
    }
  }
}

async function refreshDiagnostics(
  document: vscode.TextDocument,
  extensionPath: string,
  diagnostics: vscode.DiagnosticCollection,
  diagnosticsLifecycle: DiagnosticsLifecycleState
) {
  if (diagnosticsLifecycle.disposed) return;

  if (indexingPromise) await indexingPromise;
  if (diagnosticsLifecycle.disposed) return;

  const docDiagnostics: vscode.Diagnostic[] = [];

  for (let line = 0; line < document.lineCount; line++) {
    if (diagnosticsLifecycle.disposed) return;

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

  if (diagnosticsLifecycle.disposed) return;
  try {
    diagnostics.set(document.uri, docDiagnostics);
  } catch (e) {
    // VS Code may dispose the collection while async work is in flight.
    // Ignore late writes during shutdown/deactivation.
  }
}

/**
 * Scans the entire workspace using glob patterns to build the step definition index.
 */
async function indexWorkspace(extensionPath: string, patterns: string[]) {
  try {
    const filesByPattern = await Promise.all(
      patterns.map(pattern => vscode.workspace.findFiles(pattern, '**/node_modules/**'))
    );

    // Deduplicate files that may match multiple glob patterns.
    const uniqueFiles = new Map<string, vscode.Uri>();
    for (const files of filesByPattern) {
      for (const file of files) {
        uniqueFiles.set(normalizePath(file.fsPath), file);
      }
    }

    // Use bounded concurrency to avoid long sequential scans while keeping I/O sane.
    const concurrency = Math.min(8, Math.max(1, uniqueFiles.size));
    const uris = Array.from(uniqueFiles.values());
    let cursor = 0;

    const workers = Array.from({ length: concurrency }, async () => {
      while (true) {
        const idx = cursor;
        cursor += 1;
        if (idx >= uris.length) break;
        await indexFile(uris[idx], extensionPath);
      }
    });

    await Promise.all(workers);
  } finally {
    // Ensure callers never await a stale/pending promise forever on failures.
    indexingPromise = null;
  }
}

/**
 * Parses a single source file to extract step definition patterns (e.g., @Given("...")).
 * Automatically updates the global stepCache.
 *
 * When diagnostics/lifecycle are provided and we are NOT in the initial workspace scan
 * (indexingPromise === null), diagnostics for all open Gherkin documents are refreshed
 * inline here — avoiding a redundant second loop in the caller.
 */
async function indexFile(
  uri: vscode.Uri,
  extensionPath: string,
  diagnostics?: vscode.DiagnosticCollection,
  diagnosticsLifecycle?: DiagnosticsLifecycleState
) {
  if (!uri || !uri.fsPath) return;
  if (diagnosticsLifecycle?.disposed) return;

  // Prevent duplicate entries if a file is modified
  clearPathFromCache(uri);

  try {
    const content = await vscode.workspace.fs.readFile(uri);
    if (diagnosticsLifecycle?.disposed) return;

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
        const existing = stepCache.get(pattern) || [];
        stepCache.set(pattern, [...existing, new vscode.Location(uri, pos)]);
      }
    }
  } catch (e) { }

  // P0: For incremental updates (file watcher events), refresh diagnostics for open
  // Gherkin documents here — in the same call — instead of requiring the caller to
  // schedule a separate refreshAllOpenGherkinDiagnostics() loop.
  // Skip during the initial workspace scan (indexingPromise !== null) to avoid
  // re-running diagnostics after every individual file during bulk indexing.
  if (diagnostics && diagnosticsLifecycle && diagnosticsEnabled && !indexingPromise) {
    for (const document of vscode.workspace.textDocuments) {
      if (diagnosticsLifecycle.disposed) return;
      if (document.languageId === 'gherkin') {
        await refreshDiagnostics(document, extensionPath, diagnostics, diagnosticsLifecycle);
        if (diagnosticsLifecycle.disposed) return;
      }
    }
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
  indexingPromise = null;
}

function getMatchingLocations(lineText: string, extensionPath: string): vscode.Location[] {
  const results: vscode.Location[] = [];

  // Scan the cache for patterns that match the current Gherkin step text
  for (const [pattern, locations] of stepCache.entries()) {
    if (StepMatcher.isMatch(lineText, pattern, extensionPath)) {
      results.push(...locations);
    }
  }

  return results;
}