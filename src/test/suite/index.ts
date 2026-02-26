import * as path from 'path';
import Mocha = require('mocha');
import { glob } from 'glob';

export function run(): Promise<void> {
    // Create the mocha instance
    const mocha = new Mocha({
        ui: 'tdd',
        color: true
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
                        if (failures > 0) {
                            e(new Error(`${failures} tests failed.`));
                        } else {
                            c();
                        }
                    });
                } catch (err) {
                    console.error(err);
                    e(err);
                }
            })
            .catch(err => {
                return e(err);
            });
    });
}