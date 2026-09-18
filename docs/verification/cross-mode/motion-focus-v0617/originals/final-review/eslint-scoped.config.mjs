import globals from '/Users/oleksandr.mekhovov/work/my_projects/go_test/node_modules/globals/index.js';
export default [
 { files: ['**/*.mjs'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module' }, rules: {'no-undef': ['error', { typeof: true }], 'no-unreachable': 'error'} },
 { files: ['authoring/**/*.mjs'], languageOptions: {globals: globals.browser} },
 { files: ['game/test/**/*.mjs'], languageOptions: {globals: globals.nodeBuiltin} },
];
