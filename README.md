# <img src="./icon.png" width="50" height="50"> Gherkin Step Navigator

🚀 **Instantly jump from Gherkin feature steps to their code implementations across C#, Java, Python, and more.**

Gherkin Step Navigator is a lightweight, high-performance VS Code extension that brings "Go to Definition" support to BDD (Behavior Driven Development) frameworks. By reading directly from the Gherkin grammar, it supports international keywords (like *Angenommen*, *Étant donné*, *Dado*) out of the box.

---

## 🌟 Key Features

- **Universal "Go to Definition" (F12):** Ctrl+Click any step in a `.feature` file to jump directly to the matching code implementation.
- **Smart Multi-Language Support:** Unlike other extensions, this one parses your installed Gherkin grammar (`tmLanguage`). If VS Code supports a Gherkin keyword, this extension does too.
- **Cross-Language Step Detection:** Automatically indexes and matches:
  - **C#:** `[Given(@"regex")]`
  - **Java:** `@Given("regex")` or `@Given("Cucumber Expression")`
  - **Python:** `@given('regex')` or `@when(u'unicode')`
- **Smart Parameter Normalization:** Handles Cucumber Expressions like `{int}`, `{string}`, and `{word}`, as well as Python-style `{count:d}`.
- **Auto-Formatting:** - **Indentation:** Intelligent Gherkin indentation (Feature: 0, Scenario: 2, Step: 4).
  - **Table Alignment:** Vertically aligns pipes `|` based on the maximum cell width in the column.
  - **DocStrings:** Properly indents triple quotes `"""` to 6 spaces.



---

## ⚙️ Configuration

You can customize where the extension looks for step definitions and how it handles different languages. Go to **Settings** and search for `Gherkin Step Navigator`.

### Step File Patterns
The indexer scans your workspace based on these glob patterns. 
* **C# (Default):** `["**/*Steps.cs"]`
* **Java:** `["src/test/java/**/*.java"]`
* **Python:** `["features/steps/**/*.py"]`
* **Universal:** `["**/*.{cs,java,py,ts,js}"]`

### Performance Note
The indexer is optimized to skip `node_modules`, `bin`, `obj`, and `.venv` directories automatically to ensure the UI remains snappy even in massive mono-repos.

---

## 🚀 Getting Started

1. **Install** the extension from the VS Code Marketplace.
2. **Open a `.feature` file.**
3. **F12 on a Step:** Place your cursor on a step (e.g., `Given the user is logged in`) and press `F12`. Ctrl+Click on a step also works!
4. **Result:** The extension will scan your configured files and take you directly to the code implementation.

---

## 🛠️ Requirements

* **VS Code 1.97.0+**
* A Gherkin grammar extension (usually built into VS Code) for international keyword support.

## 🤝 Contributing

Found a regex pattern or a specific language decorator we missed? Open an issue or submit a PR on [GitHub](https://github.com/danny-briskin/gherkin-step-navigator).

---

 