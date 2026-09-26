import globals from 'globals';
import { noShadowedTranslator } from './scripts/eslint-localization.mjs';

export default [
  {
    ignores: [
      '**/node_modules/**',
      'game/vendor/**',
      'dist/**',
      'releases/**',
      'platforms/desktop/site/**',
      'platforms/desktop/out/**',
      'platforms/ios/www/**',
      'platforms/ios/bridge/dist/**',
      'platforms/ios/native/**',
    ],
  },
  {
    files: [
      'game/**/*.mjs',
      'intake/**/*.mjs',
      'scripts/**/*.mjs',
      'site/**/*.mjs',
      'platforms/**/*.{mjs,js}',
      'eslint.config.mjs',
    ],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    plugins: { localization: { rules: { 'no-shadowed-translator': noShadowedTranslator } } },
    rules: {
      'localization/no-shadowed-translator': 'error',
      'no-undef': ['error', { typeof: true }],
      'no-unreachable': 'error',
    },
  },
  {
    files: ['game/**/*.mjs', 'site/**/*.mjs'],
    ignores: ['game/core/**', 'game/test/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['game/core/**/*.mjs'],
    // The deterministic kernel uses this shared platform API, but no DOM or Node globals.
    languageOptions: { globals: { structuredClone: 'readonly' } },
  },
  {
    files: [
      'intake/**/*.mjs',
      'scripts/**/*.mjs',
      'game/test/**/*.mjs',
      'platforms/**/*.mjs',
      'eslint.config.mjs',
    ],
    ignores: ['platforms/ios/diagnostics/**'],
    // ESM files do not implicitly receive CommonJS require/module/__dirname.
    languageOptions: { globals: globals.nodeBuiltin },
  },
  {
    files: ['platforms/ios/diagnostics/*.{mjs,js}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['game/app.mjs'],
    // The vendored classic script in game/index.html creates the Phaser namespace.
    languageOptions: { globals: { Phaser: 'readonly' } },
  },
];
