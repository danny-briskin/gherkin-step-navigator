import * as assert from 'assert';
import { StepMatcher } from '../../matcher'; // No longer a comment!

suite('Gherkin Step Matcher Test Suite', () => {
    test('Multi-Language: Should match French Gherkin', () => {
        const pattern = "l'utilisateur est connecté";
        const gherkin = "Étant donné l'utilisateur est connecté"; // 'Étant donné' is in your JSON
        // Pass __dirname or a mock path to simulate extension location
        assert.strictEqual(StepMatcher.isMatch(gherkin, pattern, process.cwd()), true);
    });

    test('Multi-Language: Should match German Gherkin', () => {
        const pattern = "ich bin auf der Startseite";
        const gherkin = "Angenommen ich bin auf der Startseite"; // 'Angenommen' is in your JSON
        assert.strictEqual(StepMatcher.isMatch(gherkin, pattern, process.cwd()), true);
    });
});