import * as assert from 'assert';
import * as path from 'path';
import { StepMatcher } from '../../matcher';

suite('Gherkin Step Matcher Test Suite', () => {
    const extensionPath = path.resolve(__dirname, '../../../../');

    test('Multi-Language: Should match French Gherkin', () => {
        const stepText = "Étant donné l'utilisateur est connecté";
        const csharpPattern = "l'utilisateur est connecté";

        const isMatch = StepMatcher.isMatch(stepText, csharpPattern, extensionPath);
        assert.strictEqual(isMatch, true, `French match failed for: ${stepText}`);
    });

    test('Multi-Language: Should match German Gherkin', () => {
        const extensionPath = path.resolve(__dirname, '../../../../');
        const stepText = "Angenommen ich bin auf der Startseite";
        const pattern = "ich bin auf der Startseite";

        const isMatch = StepMatcher.isMatch(stepText, pattern, extensionPath);
        assert.strictEqual(isMatch, true, `German match failed for: ${stepText}`);
    });

    test('Manual Check: Keyword string contains German', () => {
        const keywords = (StepMatcher as any).getKeywords(extensionPath);

        const hasGerman = keywords.toLowerCase().includes('angenommen');
        assert.strictEqual(hasGerman, true, `German keyword missing from raw string. Found: ${keywords.substring(0, 50)}`);
    });

    test('Source Regex: Should capture cucumber-js Given string pattern', () => {
        const source = "Given('the JavaScript user has {int} widgets', function () {})";
        const regex = StepMatcher.getSourceRegex(extensionPath);
        const match = regex.exec(source);

        assert.ok(match, 'Expected cucumber-js Given() pattern to be captured');
        const extracted = match?.[1] || match?.[2] || match?.[3] || match?.[4];
        assert.strictEqual(extracted, 'the JavaScript user has {int} widgets');
    });

    test('Source Regex: Should capture cucumber-js regex literal pattern', () => {
        const source = 'When(/^the user has (\\d+) widgets$/, () => {})';
        const regex = StepMatcher.getSourceRegex(extensionPath);
        const match = regex.exec(source);

        assert.ok(match, 'Expected cucumber-js regex literal to be captured');
        const extracted = match?.[1] || match?.[2] || match?.[3] || match?.[4];
        assert.strictEqual(extracted, '^the user has (\\d+) widgets$');
    });
});