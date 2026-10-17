import path from 'node:path';
import { isOptionalNativeBridgeImport } from './optional-import-capabilities.mjs';
// Publishing-only copy of the package-lock pinned Acorn 8.18.0 (MIT).
// This keeps the trusted sparse publisher independent of npm installation.
import { parse } from './vendor/acorn-8.18.0.mjs';

/** Check archive bytes without executing them or resolving against the checkout.
 * Inventory counts alone cannot prove that a module's transitive imports ship. */
export function validateOptionalModuleClosure(files, policy) {
  let modules = 0,
    imports = 0;
  for (const [owner, bytes] of files) {
    if (!/\.(?:mjs|js)$/.test(owner)) continue;
    modules++;
    const pending = [
      parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes), {
        sourceType: 'module',
        ecmaVersion: 'latest',
      }),
    ];
    while (pending.length) {
      const node = pending.pop();
      if (!node || typeof node !== 'object') continue;
      if (
        [
          'ImportDeclaration',
          'ExportNamedDeclaration',
          'ExportAllDeclaration',
          'ImportExpression',
        ].includes(node.type) &&
        node.source
      ) {
        if (node.type === 'ImportExpression' && (node.options != null || node.phase != null))
          throw new Error(
            `Optional archive module does not admit import options or phases: ${owner}`,
          );
        if (isOptionalNativeBridgeImport(owner, node, policy)) continue;
        const source = node.source.value;
        if (typeof source !== 'string' || !/^\.\.?\//.test(source) || /[?#\\]/.test(source))
          throw new Error(`Optional archive module requires an explicit relative import: ${owner}`);
        if (
          node.type === 'ImportExpression' &&
          policy?.coreOnlyImports?.some((entry) => entry.from === owner && entry.source === source)
        )
          continue;
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(owner), source));
        if (target.startsWith('../') || !files.has(target))
          throw new Error(`Optional archive module dependency is missing: ${owner} -> ${target}`);
        imports++;
      }
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) pending.push(...child);
        else if (child && typeof child === 'object') pending.push(child);
      }
    }
  }
  return { modules, imports };
}
