"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// src/matcher.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var StepMatcher = class {
  static {
    this.cachedKeywords = null;
  }
  static getKeywords(extensionPath) {
    if (this.cachedKeywords !== null) return this.cachedKeywords;
    try {
      const possiblePaths = [
        path.join(extensionPath, "syntaxes", "feature.tmLanguage.json"),
        path.join(extensionPath, "..", "syntaxes", "feature.tmLanguage.json"),
        path.join(__dirname, "..", "syntaxes", "feature.tmLanguage.json")
      ];
      let grammarPath = "";
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          grammarPath = p;
          break;
        }
      }
      if (grammarPath) {
        const content = fs.readFileSync(grammarPath, "utf8");
        const grammar = JSON.parse(content);
        const repo = grammar.repository;
        const keywordPatterns = [
          repo.step_keyword?.match,
          repo.and_keyword?.match,
          repo.when_keyword?.match,
          repo.then_keyword?.match,
          repo.given_keyword?.match
        ].filter(Boolean);
        const allWords = keywordPatterns.flatMap((pattern) => {
          const match = pattern.match(/\((.*)\)/);
          if (!match) return [];
          return match[1].split("|").map((k) => {
            return k.replace(/[\\^$*+?.()|[\]{}]/g, "").trim();
          });
        });
        const uniqueKeywords = [...new Set(allWords)].filter((k) => k.length > 0);
        this.cachedKeywords = uniqueKeywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
        return this.cachedKeywords;
      }
    } catch (err) {
    }
    return "Given|When|Then|And|But|Angenommen|\xC9tant donn\xE9|Et|Und";
  }
  static extractRegex(line, extensionPath) {
    try {
      const keywords = this.getKeywords(extensionPath);
      const allKeywords = `${keywords}|StepDefinition`;
      const pattern = `\\[\\s*(?:${allKeywords})\\s*\\(\\s*@?"(.*)"\\s*\\)\\s*\\]`;
      const regex = new RegExp(pattern, "i");
      const match = line.match(regex);
      return match ? match[1] : null;
    } catch (e) {
      return null;
    }
  }
  static isMatch(stepText, csharpPattern, extensionPath) {
    try {
      const keywords = this.getKeywords(extensionPath);
      const keywordRegex = new RegExp(`^\\s*(?:${keywords})\\s+`, "i");
      if (!keywordRegex.test(stepText)) return false;
      const cleanStep = stepText.replace(keywordRegex, "").trim();
      const cleanPattern = csharpPattern.replace(/""/g, '"').trim();
      const regex = new RegExp(`^${cleanPattern}$`, "i");
      return regex.test(cleanStep);
    } catch (e) {
      return false;
    }
  }
};

// src/extension.ts
function activate(context) {
  const provider = vscode.languages.registerDefinitionProvider(
    { language: "gherkin", scheme: "file" },
    {
      async provideDefinition(document, position) {
        const lineText = document.lineAt(position.line).text;
        const stepDefinitions = await findStepDefinitions(context);
        for (const step of stepDefinitions) {
          if (StepMatcher.isMatch(lineText, step.pattern, context.extensionPath)) {
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
async function findStepDefinitions(context) {
  let files = [];
  const workspaceFiles = await vscode.workspace.findFiles("**/*.cs");
  files = [...workspaceFiles];
  if (files.length === 0) {
    const getFiles = (dir) => {
      if (!fs2.existsSync(dir)) return [];
      let results = [];
      const list = fs2.readdirSync(dir);
      for (let file of list) {
        const fullPath = path2.join(dir, file);
        if (fullPath.includes("node_modules")) continue;
        if (fs2.statSync(fullPath).isDirectory()) {
          results = results.concat(getFiles(fullPath));
        } else if (fullPath.endsWith(".cs")) {
          results.push(fullPath);
        }
      }
      return results;
    };
    const searchRoot = context.extensionPath;
    const found = getFiles(searchRoot);
    files = found.map((p) => vscode.Uri.file(p));
  }
  const definitions = [];
  for (const file of files) {
    try {
      const content = fs2.readFileSync(file.fsPath, "utf8");
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        const pattern = StepMatcher.extractRegex(line, context.extensionPath);
        if (pattern) {
          definitions.push({ pattern, line: index, file: file.fsPath });
        }
      });
    } catch (err) {
    }
  }
  return definitions;
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
