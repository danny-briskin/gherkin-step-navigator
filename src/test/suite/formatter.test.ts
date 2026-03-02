import * as assert from 'assert';
import * as vscode from 'vscode';
import { GherkinFormatter, GherkinKeywords } from '../../formatter';

suite('Gherkin Formatter Test Suite', () => {

    // Define mock keywords to simulate the regex generated from tmLanguage.json
    const mockKeywords: GherkinKeywords = {
        features: /^\s*(Feature|Business Need|Ability):/i,
        elements: /^\s*(Scenario|Background|Example|Scenario Outline|Rule):/i,
        steps: /^\s*(Given|When|Then|And|But|\*)\s+/i
    };

    test('Indentation: Should correctly indent Feature, Scenario, and Steps', async () => {
        const content =
            `Feature: Guess the word
Scenario: Maker starts a game
Given the Maker has started a game
When the Maker starts a game
Then the Maker waits for a Breaker to join`;

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'gherkin'
        });

        // Pass the mockKeywords to the formatter
        const edits = GherkinFormatter.format(doc, mockKeywords);

        // We expect 4 edits: 1 for Scenario (2 spaces) and 3 for Steps (4 spaces)
        assert.strictEqual(edits.length, 4);

        assert.ok(edits.some(e => e.newText === '  Scenario: Maker starts a game'), 'Scenario should have 2 spaces');
        assert.ok(edits.some(e => e.newText === '    Given the Maker has started a game'), 'Step should have 4 spaces');
    });

    test('Table Alignment: Should align pipes vertically based on max cell width', async () => {
        const content =
            `Feature: Table Test
  Scenario: Aligning tables
    Given the following users:
    |name|email|phone|
    |Alice|alice@example.com|123|
    |Bob|bob@gmail.com|999999999|`;

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'gherkin'
        });

        const edits = GherkinFormatter.format(doc, mockKeywords);

        // Bob is on line index 5
        const bobEdit = edits.find(e => e.range.start.line === 5);
        const expected = "      | Bob   | bob@gmail.com     | 999999999 |";

        assert.ok(bobEdit, "Formatter should have generated an edit for the Bob row");
        assert.strictEqual(bobEdit?.newText, expected);
    });

    test('DocStrings: Should indent triple quotes to 6 spaces', async () => {
        const content =
            `Feature: DocString Test
  Scenario: Text block
    Given a blog post:
"""
This is a multi-line
string.
"""`;

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'gherkin'
        });

        const edits = GherkinFormatter.format(doc, mockKeywords);

        // Opening quotes on line index 3
        const docStringEdit = edits.find(e => e.range.start.line === 3);
        assert.strictEqual(docStringEdit?.newText, '      """');
    });

    test('Internationalization: Should indent German keywords correctly', async () => {
        const germanKeywords: GherkinKeywords = {
            features: /^\s*(Funktionalität|Feature):/i,
            elements: /^\s*(Szenario|Grundlage):/i,
            steps: /^\s*(Angenommen|Wenn|Dann|Und|Aber|\*)\s+/i
        };

        const content =
            `Funktionalität: Anmeldung
Szenario: Erfolgreiches Einloggen
Angenommen der User ist auf der Seite`;

        const doc = await vscode.workspace.openTextDocument({ content, language: 'gherkin' });
        const edits = GherkinFormatter.format(doc, germanKeywords);

        assert.ok(edits.some(e => e.newText === '  Szenario: Erfolgreiches Einloggen'));
        assert.ok(edits.some(e => e.newText === '    Angenommen der User ist auf der Seite'));
    });
});