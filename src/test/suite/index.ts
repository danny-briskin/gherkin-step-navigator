import * as fs from 'fs';
import { glob } from 'glob';
import * as path from 'path';
import Mocha = require('mocha');

const testLogPath = path.resolve(__dirname, '../../../.vscode-test-logs/extension-test.log');

function writeTestLog(message: string, error?: unknown): void {
    try {
        fs.mkdirSync(path.dirname(testLogPath), { recursive: true });
        const detail = error instanceof Error ? `${error.stack || error.message}` : String(error ?? '');
        fs.appendFileSync(testLogPath, `[${new Date().toISOString()}] ${message}${detail ? `\n${detail}` : ''}\n`);
    } catch {
        // Logging must never interfere with the test host.
    }
}

function isExpectedShutdownCancellation(reason: unknown): boolean {
    return reason instanceof Error && reason.message === 'Canceled';
}

process.on('uncaughtException', error => {
    writeTestLog('uncaughtException', error);
});

process.on('unhandledRejection', reason => {
    if (isExpectedShutdownCancellation(reason)) return;
    writeTestLog('unhandledRejection', reason);
});

export function run(): Promise<void> {
    writeTestLog('test host started');

    // Create the mocha instance
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000 // Set a global default timeout of 10 seconds
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((c, e) => {
        // Look for all files ending in .test.js inside the out/test/suite folder
        glob('**/**.test.js', { cwd: testsRoot })
            .then(files => {
                // Add files to the mocha instance
                files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

                try {
                    // Run the mocha test
                    mocha.run(failures => {
                        writeTestLog(`test host completed with ${failures} failure(s)`);
                        if (failures > 0) {
                            e(new Error(`${failures} tests failed.`));
                        } else {
                            c();
                        }
                    });
                } catch (err) {
                    writeTestLog('Mocha runner threw', err);
                    console.error(err);
                    e(err);
                }
            })
            .catch(err => {
                writeTestLog('test discovery failed', err);
                return e(err);
            });
    });
}