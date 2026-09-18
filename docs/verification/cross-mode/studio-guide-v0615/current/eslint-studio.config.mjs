import base from 'file:///Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/p03-studio-guide-v0615/eslint.config.mjs';
import globals from 'file:///Users/oleksandr.mekhovov/work/my_projects/go_test/node_modules/globals/index.js';
export default [...base, { files: ['authoring/asset-studio/**/*.mjs'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser }, rules: { 'no-undef': ['error', { typeof: true }], 'no-unreachable': 'error' } }];
