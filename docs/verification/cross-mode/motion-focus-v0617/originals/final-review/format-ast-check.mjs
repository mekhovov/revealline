import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parse } from '/Users/oleksandr.mekhovov/work/my_projects/go_test/node_modules/espree/dist/espree.cjs';
const paths = ["authoring/motion-lab/display.mjs", "game/test/motion-lab-display-host.test.mjs"];
function ast(file) {return JSON.stringify(parse(fs.readFileSync(file,'utf8'),{ecmaVersion:'latest',sourceType:'module'}), (key,value)=>['start','end','loc','range','raw'].includes(key)?undefined:value);}
for (const path of paths) {assert.equal(ast('/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p03-motion-focus-rotation-4fd8/final-review/pre-format/'+path),ast('/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/p03-motion-focus-rotation/'+path)); console.log(path+': AST unchanged by formatting');}
