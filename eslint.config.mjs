import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'game/vendor/**', 'dist/**', 'releases/**'] },
  {
    files: ['game/**/*.mjs', 'scripts/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-undef': ['error', { typeof: true }],
      'no-unreachable': 'error',
    },
  },
  {
    files: ['game/**/*.mjs'],
    ignores: ['game/core/**', 'game/test/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['game/core/**/*.mjs'],
    // The deterministic kernel uses this shared platform API, but no DOM or Node globals.
    languageOptions: { globals: { structuredClone: 'readonly' } },
  },
  {
    files: ['scripts/**/*.mjs', 'game/test/**/*.mjs', 'eslint.config.mjs'],
    // ESM files do not implicitly receive CommonJS require/module/__dirname.
    languageOptions: { globals: globals.nodeBuiltin },
  },
  {
    files: ['game/app.mjs'],
    // The vendored classic script in game/index.html creates the Phaser namespace.
    languageOptions: { globals: { Phaser: 'readonly' } },
  },
];
