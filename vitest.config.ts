import { configDefaults, defineConfig } from 'vitest/config';

// `npm test` skips the slow solver suite; `npm run test:levels` runs only that.
const levels = process.env.LEVELS === '1';

export default defineConfig({
  test: {
    include: levels ? ['src/**/*.slow.test.ts'] : ['src/**/*.test.ts'],
    exclude: levels ? configDefaults.exclude : [...configDefaults.exclude, 'src/**/*.slow.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // The level solver is CPU-bound: one level file per core, leaving a core free.
    maxWorkers: levels ? 3 : undefined,
  },
});
