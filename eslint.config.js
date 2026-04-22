import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tsEslint from 'typescript-eslint';

export default [
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
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        {
          ignorePrimitives: {
            string: true,
            boolean: true,
            number: true,
            bigint: true,
          },
        },
      ],
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
      parserOptions: { project: ['./tsconfig.json', './tsconfig.*.json'] },
    },
  },
];
