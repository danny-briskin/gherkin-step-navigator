"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const path = __importStar(require("path"));
const matcher_1 = require("../../matcher");
suite('Gherkin Step Matcher Test Suite', () => {
    const extensionPath = path.resolve(__dirname, '../../../../');
    test('Multi-Language: Should match French Gherkin', () => {
        const stepText = "Étant donné l'utilisateur est connecté";
        const csharpPattern = "l'utilisateur est connecté";
        const isMatch = matcher_1.StepMatcher.isMatch(stepText, csharpPattern, extensionPath);
        assert.strictEqual(isMatch, true, `French match failed for: ${stepText}`);
    });
    test('Multi-Language: Should match German Gherkin', () => {
        const stepText = "Angenommen ich bin auf der Startseite";
        const csharpPattern = "ich bin auf der Startseite";
        const isMatch = matcher_1.StepMatcher.isMatch(stepText, csharpPattern, extensionPath);
        assert.strictEqual(isMatch, true, `German match failed for: ${stepText}`);
    });
    test('Manual Check: Keyword string contains German', () => {
        // Accessing private method for debugging via type casting
        const keywords = matcher_1.StepMatcher.getKeywords(extensionPath);
        console.log("DEBUG - Loaded Keywords:", keywords.substring(0, 100));
        const hasGerman = keywords.toLowerCase().includes('angenommen');
        assert.strictEqual(hasGerman, true, `German keyword missing from raw string. Found: ${keywords.substring(0, 50)}`);
    });
});
