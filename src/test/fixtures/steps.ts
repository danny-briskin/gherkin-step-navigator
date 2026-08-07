declare function defineStep(pattern: string, implementation: (...args: any[]) => unknown): void;

defineStep('the TypeScript user has {int} tasks', async function (count: number) {
    return count;
});
