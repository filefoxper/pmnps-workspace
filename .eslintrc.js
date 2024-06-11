const airbnbStyleRules = require('eslint-config-airbnb-base/rules/style');

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    es6: true,
  },
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
    self: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['import', 'react', 'unused-imports'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
    '@typescript-eslint/consistent-type-imports':'error',
    'unused-imports/no-unused-vars': [
      'warn',
      { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_', ignoreRestSiblings: true },
    ],
    '@typescript-eslint/default-param-last': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'class-methods-use-this': 'off',
    'consistent-return': 'off',
    'consistent-this': ['warn', 'self'],
    curly: ['error', 'all'],
    'func-names': 'error',
    'import/no-unresolved': ['error', { caseSensitive: true }],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'never',
        pathGroups: [{ pattern: '@/**', group: 'internal' }],
        pathGroupsExcludedImportTypes: ['type'],
      },
    ],
    'import/prefer-default-export': 'off',
    'max-classes-per-file': 'off',
    'max-len': ['error', { code: 120, ignoreStrings: true }],
    'max-nested-callbacks': 'off',
    'max-params': 'off',
    'no-alert': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-constant-condition': 'error',
    'no-eq-null': 'off',
    'no-nested-ternary': 'off',
    'no-param-reassign': ['error', { props: true, ignorePropertyModificationsForRegex: ['^draft'] }],
    'no-warning-comments': ['off'],
    'no-plusplus':'off',
    quotes: ['error', 'single', { ...airbnbStyleRules.rules.quotes[2], allowTemplateLiterals: false }],
  },
};
