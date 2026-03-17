import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

import { GherkinFormatter } from '../../formatter';
import { StepMatcher } from '../../matcher';

suite('Gherkin Formatter Integration Test Suite', () => {
    const keywords = {
        features: /Feature/i,
        elements: /Scenario|Background/i,
        steps: /Given|When|Then|And|But/i
    };

    function mockDocument(content: string): vscode.TextDocument {
        const lines = content.split('\n');
        return {
            lineCount: lines.length,
            lineAt: (i: number) => ({ text: lines[i], range: new vscode.Range(i, 0, i, lines[i].length) } as any)
        } as any;
    }
    function applyEdits(content: string, edits: vscode.TextEdit[]): string {
        let lines = content.split('\n');
        edits.forEach(edit => {
            console.log(`Applying edit to line ${edit.range.start.line}: "${edit.newText}"`);
            lines[edit.range.start.line] = edit.newText;
        });
        return lines.join('\n');
    }

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

    test('Should align table with commented lines and maintain indentation', () => {
        const input = `Scenario: Test
  Given a step
    | Name | Value |
    # | Comm | ent |
    | Row1 | Val1   |`;

        const expected = `Scenario: Test
    Given a step
      | Name | Value |
      # | Comm | ent |
      | Row1 | Val1  |`; // Matches expected width padding

        const edits = GherkinFormatter.format(mockDocument(input), keywords);
        const result = applyEdits(input, edits);

        assert.strictEqual(result.trim(), expected.trim(), "Table alignment failed with comments");
    });

    test('Should preserve indentation of comments between steps', () => {
        const input =
            `    Given a step
      | Name |
      | Bob  |
    # This comment should be 4 spaces
        # This comment after another comment should be 4 spaces
    
    # This comment follows an empty line and should be 4 spaces
        # This comment prior to step another comment should be 4 spaces
    Then another step`;

        const expected = `    Given a step
      | Name |
      | Bob  |
    # This comment should be 4 spaces
    # This comment after another comment should be 4 spaces

    # This comment follows an empty line and should be 4 spaces
    # This comment prior to step another comment should be 4 spaces
    Then another step`;
        const edits = GherkinFormatter.format(mockDocument(input), keywords);
        const result = applyEdits(input, edits);

        assert.strictEqual(result.trim(), expected.trim(), "Comment indentation failed");
    });
    test('Should NOT include a comment following a table in the table alignment', () => {
        const input = [
            "| a | b |",
            "# comment",
            "Given a step"
        ].join('\n');

        // This creates a mock document to feed into your formatter
        const doc = mockDocument(input);
        const edits = GherkinFormatter.format(doc, keywords);

        // We expect the table (line 0) to be aligned, 
        // but the comment (line 1) to be formatted as a normal line, 
        // and the step (line 2) to be formatted as a step.
        const result = applyEdits(input, edits);

        // The debug assertion: verify the comment didn't get a pipe-aligned prefix
        assert.ok(!result.split('\n')[1].includes('|'), "Comment line should not contain pipes");
    });

    test('Advanced Alignment: Table, comment, and tag', async () => {
        const input =
            `      | Val |
       # comment
    @tagName
    Scenario: Next`;

        // RULE: '# comment' is NOT a table-comment (no pipe). 
        // It should anchor to '@tagName' (indent 2).
        const expectedLines = [
            "      | Val |",
            "  # comment",     // Anchors to @tagName (2 spaces)
            "  @tagName",      // Anchors to Scenario (2 spaces)
            "  Scenario: Next"
        ];
        const edits = GherkinFormatter.format(mockDocument(input), keywords);
        const resultLines = applyEdits(input, edits).split('\n');

        expectedLines.forEach((expectedLine, i) => {
            assert.strictEqual(resultLines[i], expectedLine, `Line ${i} indentation mismatch`);
        });
    });

    test('Advanced Alignment 2: Table, table-comment, and step', async () => {
        const input =
            `      | Val |
        # | Pipe Comment |
    Then User does smth`;

        // RULE: '# | Pipe Comment |' IS a table-comment (contains pipe).
        // It should anchor to the TABLE (6 spaces).
        const expected =
            `      | Val |
      # | Pipe Comment |
    Then User does smth`;

        const edits = GherkinFormatter.format(mockDocument(input), keywords);
        const result = applyEdits(input, edits);

        assert.strictEqual(result.trim(), expected.trim(), "Table-comment alignment failed");
    });
    test('Should default to INDENT.COMMENT for trailing comments and comments after empty lines', () => {
        const input = `Scenario: Default behavior
    Given a step
    
    # This comment is after an empty line and should be 4 spaces
    
    # This comment is at EOF and should be 4 spaces`;

        const expected = `Scenario: Default behavior
    Given a step
    
    # This comment is after an empty line and should be 4 spaces
    
    # This comment is at EOF and should be 4 spaces`;

        const edits = GherkinFormatter.format(mockDocument(input), keywords);
        const result = applyEdits(input, edits);

        // Verify specifically that these lines have 4 spaces
        const lines = result.split('\n');
        const commentLines = lines.filter(l => l.trim().startsWith('#'));

        commentLines.forEach((line, i) => {
            const indent = line.length - line.trimStart().length;
            assert.strictEqual(indent, 4, `Comment ${i} should have 4 spaces, found ${indent}`);
        });
    });

    test('Should enforce 4 spaces for comments followed by empty lines', () => {
        const input =
            `    Given a step
      | Name |
      | Bob  |
    #  | Comment stuck to table (should be 6)|
    # Comment before empty line (should be 4)

    Examples:
      | Name |`;

        // The first comment is a table-comment (starts with # |).
        // The second comment is a standard comment (starts with #).
        const expected =
            `    Given a step
      | Name |
      | Bob  |
      # | Comment stuck to table (should be 6)|
    # Comment before empty line (should be 4)

    Examples:
      | Name |`;

        const testKeywords = {
            features: /Feature/i,
            elements: /Scenario|Background|Examples/i,
            steps: /Given|When|Then|And|But/i
        };

        const edits = GherkinFormatter.format(mockDocument(input), testKeywords);
        const result = applyEdits(input, edits);

        // Verify indentation
        const lines = result.split('\n');
        const tableCommentIndent = lines[3].length - lines[3].trimStart().length;
        assert.strictEqual(tableCommentIndent, 6, "Table comment must be 6");

        const standardCommentIndent = lines[4].length - lines[4].trimStart().length;

        assert.strictEqual(standardCommentIndent, 4, "Isolated comment must be 4");
    });
    test('Should NOT indent or modify empty lines', () => {
        const input =
            `Feature: Test
    
Scenario: Empty lines
    
    Given a step
    
    When another step`;

        // The input has empty lines with various amounts of whitespace (e.g., 4 spaces)
        // The expected result should have completely clean, empty lines (0 length)
        const expected =
            `Feature: Test

  Scenario: Empty lines

    Given a step

    When another step`;

        const edits = GherkinFormatter.format(mockDocument(input), keywords);
        const result = applyEdits(input, edits);

        assert.strictEqual(result, expected, "Empty lines should not contain indentation or remain non-empty");

        // Verify that empty lines in the result have 0 length
        const lines = result.split('\n');
        assert.strictEqual(lines[1].length, 0, "Line 1 should be empty");
        assert.strictEqual(lines[3].length, 0, "Line 3 should be empty");
        assert.strictEqual(lines[5].length, 0, "Line 5 should be empty");
    });
});