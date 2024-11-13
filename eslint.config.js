const tsEslint = require('typescript-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');
const eslintPluginUnicorn = require('eslint-plugin-unicorn');
const globals = require('globals');

module.exports = [
  ...[
    ...tsEslint.configs.recommended,
    ...tsEslint.configs.recommendedTypeChecked,
    ...tsEslint.configs.stylisticTypeChecked,
  ].map((config) => ({
    files: ['**/*.ts'],
    ...config,
  })),
  eslintConfigPrettier,
  {
    ignores: ['**/dist', '**/.yarn', '**/.husky', '**/node_modules'],
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [2, { args: 'none' }],
      'unicorn/prefer-node-protocol': 'error',
    },
    languageOptions: {
      parser: tsEslint.parser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsEslint.plugin,
      unicorn: eslintPluginUnicorn,
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { project: ['./tsconfig.json'] },
    },
  },
];
