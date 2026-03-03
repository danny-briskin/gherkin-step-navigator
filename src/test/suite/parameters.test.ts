import * as assert from 'assert';
import * as path from 'path';
import { StepMatcher } from '../../matcher';

suite('Parameter Matching Test Suite', () => {
    const extensionPath = path.resolve(__dirname, '../../../../');

    test('Cucumber Expressions: Should match {string}', () => {
        const step = 'Given the user "Admin" is logged in';
        const pattern = 'the user {string} is logged in';
        assert.strictEqual(StepMatcher.isMatch(step, pattern, extensionPath), true);
    });

    test('Cucumber Expressions: Should match {int}', () => {
        const step = 'And I have 5 items in my cart';
        const pattern = 'I have {int} items in my cart';
        assert.strictEqual(StepMatcher.isMatch(step, pattern, extensionPath), true);
    });

    test('SpecFlow: Should match {count:d} style parameters', () => {
        const step = 'Then there are 10 results';
        const pattern = 'there are {count:d} results';
        assert.strictEqual(StepMatcher.isMatch(step, pattern, extensionPath), true);
    });

    test('Regex: Should match standard (.*) capture groups', () => {
        const step = 'When I click on the Submit button';
        const pattern = 'I click on the (.*) button';
        assert.strictEqual(StepMatcher.isMatch(step, pattern, extensionPath), true);
    });

    test('Mixed: Should handle multiple parameters in one line', () => {
        const step = 'Given "User1" has 50 dollars';
        const pattern = '{string} has {int} dollars';
        assert.strictEqual(StepMatcher.isMatch(step, pattern, extensionPath), true);
    });
});