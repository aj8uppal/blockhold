import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * A lint pass that only ever complains about things that are wrong.
 *
 * The point of lint here is to catch the mistakes a type checker does not see -
 * a `case` that falls into the next one, a promise nobody awaits, a variable
 * that shadows itself into a bug - and nothing else. Deliberately absent: any
 * style opinion (the codebase has one and it is consistent), and the whole
 * `no-explicit-any` / `strict-boolean-expressions` family, which would report
 * hundreds of pre-existing lines that are not defects.
 *
 * Rules here are cheap to add and expensive to argue about, so the bar for a
 * new one is: it has caught, or would have caught, a real bug in this repo.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/sw.js',
      'tests/smoke/output/**',
      'tests/smoke/report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // TypeScript already reports unused code, and does it with the project's
      // own settings; a second, stricter opinion here is just noise
      '@typescript-eslint/no-unused-vars': 'off',
      // this codebase types its boundaries and uses `any` sparingly and on
      // purpose (three.js escape hatches, `as never` for exhaustiveness)
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      // `catch {}` is used throughout as "this genuinely does not matter":
      // pointer capture on a stale pointer, a clipboard the browser blocked
      'no-empty': ['error', { allowEmptyCatch: true }],
      // the actual bug-catchers
      'no-fallthrough': 'error',
      'no-unsafe-finally': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-constant-binary-expression': 'error',
      'no-template-curly-in-string': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // the sync service and the build/CI scripts run on Node, not in a browser
    files: ['server/**/*.ts', 'scripts/**/*.mjs', '*.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
  {
    // tests say what they mean; a console.log in a failing smoke test is the
    // diagnostic, not a slip
    files: ['tests/**'],
    rules: { 'no-console': 'off' },
  },
  {
    // The Cloudflare Worker runs in workerd, not Node: HTMLRewriter and the
    // fetch globals are provided by that runtime. Declared rather than
    // rule-disabled, so a real typo in this file is still caught.
    files: ['worker/**/*.js'],
    languageOptions: {
      globals: {
        HTMLRewriter: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
      },
    },
  },
)
