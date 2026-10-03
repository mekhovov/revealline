import globals from 'globals';
export default [
  {
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.nodeBuiltin },
    rules: { 'no-undef': ['error', { typeof: true }], 'no-unreachable': 'error' },
  },
];
