import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    files: ['src/client/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        /* Type-only DOM globals are not present in ESLint's runtime set. */
        BodyInit: 'readonly',
        EventListener: 'readonly',
        FileSystemDirectoryReader: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      /* The TypeScript-aware rule replaces ESLint's base rule for TS syntax. */
      'no-unused-vars': 'off',
      'no-undef': 'error',
    },
  },
];
