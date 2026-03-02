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
        const stepText = "Angenommen ich bin auf der Startseite";
        const csharpPattern = "ich bin auf der Startseite";

        const isMatch = StepMatcher.isMatch(stepText, csharpPattern, extensionPath);
        assert.strictEqual(isMatch, true, `German match failed for: ${stepText}`);
    });

    test('Manual Check: Keyword string contains German', () => {
        // Accessing private method for debugging via type casting
        const keywords = (StepMatcher as any).getKeywords(extensionPath);

        console.log("DEBUG - Loaded Keywords:", keywords.substring(0, 100));

        const hasGerman = keywords.toLowerCase().includes('angenommen');
        assert.strictEqual(hasGerman, true, `German keyword missing from raw string. Found: ${keywords.substring(0, 50)}`);
    });
});