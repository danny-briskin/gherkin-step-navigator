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
const matcher_1 = require("../../matcher"); // No longer a comment!
suite('Gherkin Step Matcher Test Suite', () => {
    test('Multi-Language: Should match French Gherkin', () => {
        const pattern = "l'utilisateur est connecté";
        const gherkin = "Étant donné l'utilisateur est connecté"; // 'Étant donné' is in your JSON
        // Pass __dirname or a mock path to simulate extension location
        assert.strictEqual(matcher_1.StepMatcher.isMatch(gherkin, pattern, process.cwd()), true);
    });
    test('Multi-Language: Should match German Gherkin', () => {
        const pattern = "ich bin auf der Startseite";
        const gherkin = "Angenommen ich bin auf der Startseite"; // 'Angenommen' is in your JSON
        assert.strictEqual(matcher_1.StepMatcher.isMatch(gherkin, pattern, process.cwd()), true);
    });
});
