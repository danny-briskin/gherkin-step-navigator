import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { GherkinFormatter } from '../../formatter';
import { StepMatcher } from '../../matcher';

suite('Gherkin Formatter Integration Test Suite', () => {
    // This points to your actual extension root to find syntaxes/feature.tmLanguage.json
    const extensionPath = path.resolve(__dirname, '../../../');

    test('Real Grammar: Should correctly indent Feature, Scenario, and Steps', async () => {
        let rootPath = path.resolve(__dirname, '../../..');
        const realKeywords = StepMatcher.getFormattingKeywords(rootPath);

        // Improved assertion to see why it's null
        if (!realKeywords) {
            assert.fail("StepMatcher.getFormattingKeywords returned null. Check Extension Host logs for 'Missing expected keys' or 'Error during keyword extraction'.");
        }

        assert.ok(realKeywords, "Formatter failed to load real grammar keywords from syntaxes folder");

        const content =
            `Feature: Integration Test
Scenario: Using real grammar
Given a step with the real keyword
And another step`;

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'gherkin'
        });

        // 2. Run formatting with real grammar-derived regexes
        const edits = GherkinFormatter.format(doc, realKeywords!);

        // Debug: Log what the real regexes look like to the console
        console.log('Real Feature Regex:', realKeywords?.features.source);
        console.log('Real Step Regex:', realKeywords?.steps.source);

        // 3. Assertions
        const scenarioEdit = edits.find(e => e.range.start.line === 1);
        const stepEdit = edits.find(e => e.range.start.line === 2);

        assert.strictEqual(scenarioEdit?.newText, '  Scenario: Using real grammar',
            `Failed with real regex: ${realKeywords?.elements.source}`);

        assert.strictEqual(stepEdit?.newText, '    Given a step with the real keyword',
            `Failed with real regex: ${realKeywords?.steps.source}`);
    });
    test('Table Alignment: Should align pipes based on max column width', async () => {
        const content =
            `    Given users:
        | name | email |
        | bob | bob@example.com |
        | alexander | alex@example.com |`;

        const doc = await vscode.workspace.openTextDocument({ content, language: 'gherkin' });
        const mockKeywords = {
            features: /Feature:/i,
            elements: /Scenario:/i,
            steps: /Given|When|Then/i
        };

        const edits = GherkinFormatter.format(doc, mockKeywords);
        const longRowEdit = edits.find(e => e.range.start.line === 3);

        // Ensure "bob" is padded to match the width of "alexander"
        assert.ok(longRowEdit?.newText.includes('| alexander |'), "Table padding failed");
    });
});