# <img src="./icon.png" width="50" height="50"> Gherkin Step Navigator

🚀 **Instantly jump from Gherkin feature steps to their code implementations across C#, Java, and Python.**

Gherkin Step Navigator is a lightweight, high-performance VS Code extension that brings "Go to Definition" support to BDD (Behavior Driven Development) frameworks. It is designed to be framework-agnostic, working seamlessly with SpecFlow (C#), Cucumber (Java), Behave (Python), and more.



## 🌟 Key Features

- **Universal "Go to Definition" (F12):** Ctrl+Click any step in a `.feature` file to jump directly to the matching code implementation.
- **Cross-Language Support:** Automatically detects and indexes:
  - **C#:** `[Given(@"regex")]`
  - **Java:** `@Given("regex")` or `@Given("Cucumber Expression")`
  - **Python:** `@given('regex')`
- **Smart Parameter Matching:** Handles Cucumber Expressions like `{int}`, `{string}`, and `{word}`, as well as Python-style `{count:d}`.
- **Multi-language Gherkin:** Supports international keywords (Given, Quando, Étant donné, etc.) by reading directly from the Gherkin grammar.
- **High Performance:** Built with an optimized local indexer that ignores binaries and handles large workspaces without lag.



## ⚙️ Extension Settings

You can customize where the extension looks for step definitions. Go to **Settings** and search for `Gherkin Step Navigator`.

* `gherkinStepNavigator.stepFilePattern`: An array of glob patterns to find your step definition files.
  * **C# (Default):** `["**/*Steps.cs"]`
  * **Java:** `["src/test/java/**/*.java"]`
  * **Python:** `["features/steps/**/*.py"]`
  * **Scan All:** `["**/*"]` (The indexer is optimized to skip binaries and `node_modules` automatically).

## 🚀 Getting Started

### 1. Installation
Install via the VS Code Marketplace.

### 2. Configuration
If your step definitions are not in the default `.cs` files, add your pattern to your workspace `settings.json`:

```json
{
  "gherkinStepNavigator.stepFilePattern": ["**/*.java", "**/*.py", "**/*.cs"]
}