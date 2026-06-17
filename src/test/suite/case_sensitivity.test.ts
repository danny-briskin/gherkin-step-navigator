import * as assert from 'assert';
import * as path from 'path';
import { StepMatcher } from '../../matcher';

suite('Case Sensitivity Test Suite', () => {
    const extensionPath = path.resolve(__dirname, '../../../../');

    test('Literal matching should be case-sensitive', () => {
        const step = 'Given The user "Admin" is logged in';
        const pattern = 'the user {string} is logged in';
        // Keyword matching is case-insensitive, but literal comparison should require exact case
        assert.strictEqual(StepMatcher.isMatch(step, pattern, extensionPath, true), false);

        const exactStep = 'Given the user "Admin" is logged in';
        assert.strictEqual(StepMatcher.isMatch(exactStep, pattern, extensionPath, true), true);
    });

    test('Regex matching should be case-sensitive', () => {
        const step = 'When i click on the Submit button';
        const pattern = 'I click on the (.*) button';
        // 'i' vs 'I' should fail under case-sensitive regex
        assert.strictEqual(StepMatcher.isMatch(step, pattern, extensionPath, true), false);

        const exactStep = 'When I click on the Submit button';
        assert.strictEqual(StepMatcher.isMatch(exactStep, pattern, extensionPath, true), true);
    });
});
