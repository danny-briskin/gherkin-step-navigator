# <img src="./icon.png" width="50" height="50"> Gherkin Step Navigator

🚀 **Instantly jump from Gherkin feature steps to their code implementations.**

Gherkin Step Navigator is a lightweight, high-performance extension that brings "Go to Definition" support to BDD (Behavior Driven Development) frameworks. While originally inspired by SpecFlow, this extension is designed to be framework-agnostic and works with any codebase using Gherkin syntax.

## Features

- **Go to Definition (F12):** Click on any step in a `.feature` file to jump directly to the matching C#, JavaScript, or Python step definition.
- **Peek Definition:** Preview the code implementation without leaving the feature file.
- **Scenario Outline Support:** Automatically handles variables like `<id>` or `<name>` within your steps.
- **Multi-language Support:** Works with international Gherkin keywords (Given, When, Then, Dado, Quando, Então, etc.).

## Extension Settings

You can customize where the extension looks for step definitions. Go to `Settings` and search for `Gherkin Step Navigator`.

* `gherkinStepNavigator.stepFilePattern`: An array of glob patterns to find your code-behind files.
  * Default: `["**/*Steps.cs"]`
  * Example for JavaScript: `["**/*.steps.js", "**/*.test.js"]`

## How to use

1. Open a `.feature` file.
2. Move your cursor to a step (e.g., `Given I have entered 50 into the calculator`).
3. Press `F12` or `Ctrl + Click`.
4. The extension will search your workspace for a matching regex attribute and take you there.

## Why this extension?

Many BDD extensions are bloated or tied to specific versions of IDEs. **Gherkin Step Navigator** is built to be:
1. **Fast:** It builds a local index of your steps for near-instant navigation.
2. **Flexible:** Works with any framework that uses standard Regex-based step attributes.
3. **Maintained:** Actively updated to support the latest VS Code features.

---
Created with ❤️ by [Your Name/GitHub]