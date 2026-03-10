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
    test('Tag Alignment: Should inherit indentation from subsequent element', async () => {
        // Note the intentional bad spacing: 4 spaces before @tag1 and 0 before @tag2
        const content =
            `    @tag1
Feature: Tag Test
@tag2
  Scenario: Nested tag
    Given a step`;

        const doc = await vscode.workspace.openTextDocument({ content, language: 'gherkin' });
        const mockKeywords = {
            features: /Feature:/i,
            elements: /Scenario:/i,
            steps: /Given|When|Then/i
        };

        const edits = GherkinFormatter.format(doc, mockKeywords);

        // Verify @tag1 moved from 4 spaces to 0
        const tag1Edit = edits.find(e => e.range.start.line === 0);
        assert.strictEqual(tag1Edit?.newText, '@tag1', "Root tag should have 0 indentation");

        // Verify @tag2 moved from 0 spaces to 2
        const tag2Edit = edits.find(e => e.range.start.line === 2);
        assert.strictEqual(tag2Edit?.newText, '  @tag2', "Nested tag should inherit 2-space indentation");
    });
});