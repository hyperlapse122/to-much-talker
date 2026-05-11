import js from '@eslint/js'
import tseslint from 'typescript-eslint'

// ESLint flat config. This is the ONE place where `export default` is required
// (ESLint flat config spec mandates default export). All other source files
// MUST use named exports — see AGENTS.md.
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/.yarn/**',
      '**/paraglide/**',
      '**/playwright-report/**',
      '**/.playwright/**',
      '.yarn/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      // No `as any` — use `unknown` + type guards if needed
      '@typescript-eslint/no-explicit-any': 'error',

      // No `@ts-ignore` — use `@ts-expect-error` with description (min 10 chars)
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': { descriptionFormat: '^: .{10,}$' },
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 10,
        },
      ],

      // No default exports — named exports only
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message:
            'Default exports are forbidden. Use named exports. Exceptions: eslint.config.js, commitlint.config.js.',
        },
      ],

      // No console.log anywhere by default — overrides per CLI entry below
      'no-console': 'error',

      // Prefer `satisfies` and explicit types over `as` casts
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],

      // Prevent importing test utilities outside test files
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@to-much-talker/test-utils', '@to-much-talker/test-utils/*'],
              message:
                '@to-much-talker/test-utils may only be imported from test files (*.test.ts, *.spec.ts) or within the test-utils package itself.',
            },
          ],
        },
      ],
    },
  },
  // CLI entry files may use console
  {
    files: ['apps/server/src/cli/**/*.{ts,tsx,js,mjs,cjs}'],
    rules: {
      'no-console': 'off',
    },
  },
  // Allow test-utils imports inside test files and test-utils package
  {
    files: [
      '**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}',
      'packages/test-utils/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    ],
    rules: {
      'no-restricted-imports': 'off',
      'no-console': 'off',
    },
  },
  // Config files are allowed default export
  {
    files: ['eslint.config.{js,mjs,cjs}', 'commitlint.config.{js,mjs,cjs}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
)
