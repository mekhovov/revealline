import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const revision = '8cffb36b29a38013eb9213845efd675c4864c9d8';
const repository = "/Users/oleksandr.mekhovov/work/my_projects/go_test";
const cache = new Map();
export function sourceFor(name) {
  if (!name || name.startsWith('/') || name.split('/').some(p => p === '..' || !p)) throw Error('Invalid source path');
  if (cache.has(name)) return cache.get(name);
  const own = new URL('./candidate/' + name, import.meta.url);
  const local = existsSync(own);
  const bytes = local ? readFileSync(own) : execFileSync('git', ['--no-optional-locks','show',revision+':'+name], {cwd: repository, maxBuffer: 32*1024*1024, env:{...process.env,GIT_NO_LAZY_FETCH:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
  appendFileSync(new URL('./reads/' + process.pid + '.jsonl', import.meta.url), JSON.stringify({name,origin:local?'candidate':revision,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})+'\n');
  cache.set(name, bytes); return bytes;
}
