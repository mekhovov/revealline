import path from 'node:path';
import { parse as parseModule } from 'acorn';
import { parse as parseHTML } from 'parse5';

/** Presence-only launch guards use the shipped entry's static module graph.
 * Optional navigation, dynamic tools and media never become launch prerequisites. */
export function offlineStartupRoutes(entries, files) {
  const core = new Set(files.map((file) => file.path));
  const sources = new Map(entries.map((entry) => [entry.name, entry.bytes]));
  const dependencies = new Map();
  const resolve = (owner, value) => {
    if (typeof value !== 'string' || /^(?:[a-z]+:|\/|#)/i.test(value)) return null;
    const target = path.posix.normalize(
      path.posix.join(path.posix.dirname(owner), value.split(/[?#]/)[0]),
    );
    return core.has(target) ? target : null;
  };
  function imports(name) {
    if (dependencies.has(name)) return dependencies.get(name);
    const result = [];
    dependencies.set(name, result);
    if (!/\.(?:mjs|js)$/.test(name) || name.startsWith('vendor/') || name.includes('/vendor/'))
      return result;
    const ast = parseModule(sources.get(name).toString(), {
      ecmaVersion: 'latest',
      sourceType: 'module',
    });
    for (const node of ast.body) {
      if (
        ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)
      ) {
        const target = resolve(name, node.source?.value);
        if (target) result.push(target);
      }
    }
    // The classic boot deliberately imports the main module through an absolute
    // URL after installing its failure UI. Keep that one explicit entry edge.
    if (name === 'game/boot.mjs' && core.has('game/app.mjs')) result.push('game/app.mjs');
    return result;
  }
  return files
    .filter((file) => file.path.startsWith('game/') && file.path.endsWith('.html'))
    .map(({ path: name }) => {
      const required = new Set([name]);
      const add = (target) => {
        if (!target || required.has(target)) return;
        required.add(target);
        imports(target).forEach(add);
      };
      const visit = (node) => {
        const attrs = Object.fromEntries(
          (node.attrs || []).map(({ name, value }) => [name, value]),
        );
        if (node.tagName === 'script') {
          add(resolve(name, attrs.src));
          add(resolve(name, attrs['data-module']));
        }
        if (node.tagName === 'link' && attrs.rel === 'stylesheet')
          add(resolve(name, attrs.href || attrs['data-boot-href']));
        for (const child of node.childNodes || []) visit(child);
      };
      visit(parseHTML(sources.get(name).toString()));
      return { path: name, files: [...required].sort() };
    });
}
