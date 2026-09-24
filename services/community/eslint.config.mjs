import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'coverage/**', 'var/**'] },
  {
    files: ['src/**/*.mjs', 'test/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.nodeBuiltin,
    },
    rules: {
      'no-undef': ['error', { typeof: true }],
      'no-unreachable': 'error',
    },
  },
];
