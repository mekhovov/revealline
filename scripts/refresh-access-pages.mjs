import { fileURLToPath } from 'node:url';
import { protectSourcePages } from './access-pages.mjs';
const check = process.argv.includes('--check');
const files = await protectSourcePages(fileURLToPath(new URL('../', import.meta.url)), { check });
console.log(`Password gate ${check ? 'checked' : 'applied'}: ${files.length} source pages.`);
