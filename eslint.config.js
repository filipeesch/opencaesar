import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'phaser',
              message: 'src/sim must never import Phaser — the simulation is framework-free and headless-testable.',
            },
            {
              name: 'crypto',
              message: 'src/sim must never use crypto — all randomness must come from the injected seeded RNG.',
            },
          ],
          patterns: [
            {
              group: ['**/game/**', '**/src/game/**', '../game/*', '../game/**'],
              message: 'src/sim must never import from src/game — keep the sim/renderer boundary strict.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'src/sim must never use Math.random — all randomness must come from the injected seeded RNG.',
        },
      ],
    },
  }
);
