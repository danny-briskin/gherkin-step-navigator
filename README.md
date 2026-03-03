# <img src="./icon.png" width="50" height="50"> Gherkin Step Navigator

🚀 **Instantly jump from Gherkin feature steps to their code implementations across C#, Java, Python, and more.**

Gherkin Step Navigator is a lightweight, high-performance VS Code extension that brings "Go to Definition" support to BDD (Behavior Driven Development) frameworks. By reading directly from the Gherkin grammar, it supports international keywords (like *Angenommen*, *Étant donné*, *Dado*) out of the box while providing rich, theme-integrated syntax coloring for all Gherkin elements..

---

## 🌟 Key Features

- **Universal "Go to Definition" (F12):** Ctrl+Click any step in a `.feature` file to jump directly to the matching code implementation.
- **Smart Multi-Language Support:** Automatically parses your installed Gherkin grammar (`tmLanguage`). If VS Code highlights it, this extension can navigate it.
- **Robust Step Detection:** Automatically indexes and matches definitions across multiple languages. For example:
  - **C# / SpecFlow / Reqnroll:** `[Given(@"regex")]`
  - **Java / Cucumber:** `@Given("regex")` or `@Given("Cucumber Expression")`
  - **Python / Behave:** `@given('regex')` or `@when(u'unicode')`
- **Advanced Parameter Matching:** Supports Cucumber Expressions like `{int}`, `{string}`, `{word}`, and `{float}`, as well as SpecFlow-style `{count:d}`.
- **Intelligence Formatting:** - **Auto-Indentation:** Feature (0), Scenario (2), and Steps (4 spaces).
  - **Dynamic Table Alignment:** Vertically aligns pipes `|` based on column content width.
  - **DocStrings:** Properly indents triple quotes `"""` to 6 spaces.

---
## 🎨 Syntax Highlighting

This extension includes a high-performance **TextMate Grammar** that provides rich syntax coloring for `.feature` files. 

- **Supports 70+ Languages:** Keywords are automatically colorized in English, French, German, Spanish, Chinese, and many more.
- **Theme Integration:** Uses standard VS Code scopes to ensure compatibility with your favorite color themes.
- **Advanced Tagging:** Highlights Scenario Outline variables `<brackets>`, DocStrings `"""`, and escaped characters within strings.

---

## ⚙️ Configuration

You can customize where the extension looks for step definitions and how it handles different languages. Go to **Settings** and search for `Gherkin Step Navigator`.

### Step File Patterns
The indexer scans your workspace based on these glob patterns. You can add specific project folders to speed up indexing:

```json
"gherkinStepNavigator.stepFilePattern": [
    "**/Company.Project.Application/Steps/*.cs",
    "src/test/java/**/*.java",
    "features/steps/**/*.py"
]
```
---

## 🚀 Getting Started

1. **Install** the extension from the VS Code Marketplace.
2. **Open a `.feature` file.**
3. **F12 on a Step:** Place your cursor on a step (e.g., `Given the user is logged in`) and press `F12`. Ctrl+Click on a step also works!
4. **Result:** The extension will scan your configured files and take you directly to the code implementation.

---

## 🛠️ Requirements

* **VS Code 1.97.0+**
* Regex Safety: The engine includes a safety layer to handle complex internationalized grammar patterns without crashing the Extension Host.
* Performance: Optimized to skip node_modules, bin, obj, and .venv directories to maintain UI responsiveness in large mono-repos.

## 🤝 Contributing

Found a regex pattern or a specific language decorator we missed? Open an issue or submit a PR on [GitHub](https://github.com/danny-briskin/gherkin-step-navigator).

---

 