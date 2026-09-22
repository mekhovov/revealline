import assert from 'node:assert/strict';

// Parse actual entry markup into the minimal DOM boundary; use native property
// handlers and real input/router/navigation/duel code. No game-action factories.
export function mountCouch(document, html) {
  const stack = [document.body];
  const match = html.match(/<body(?=[\s>])(?:[^>"']|"[^"]*"|'[^']*')*>([\s\S]*?)<\/body\s*>/i);
  assert.ok(match, 'Couch test markup requires a complete <body> element.');
  const body = match[1];
  for (const token of body.matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    const text = token[0];
    if (text.startsWith('<!--')) continue;
    if (text.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!text.startsWith('<')) {
      // A parser appends a text node; assigning textContent would remove the
      // already-parsed child controls in this finite DOM boundary.
      const parent = stack.at(-1);
      parent._text = (parent._text || '') + text.trim();
      continue;
    }
    const tag = text.match(/^<([\w-]+)/)[1];
    const node = document.createElement(tag);
    for (const [, name, quoted, bare] of text
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      node.setAttribute(name, value);
      if (name === 'class') node.className = value;
      if (name.startsWith('data-'))
        node.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      if (['type', 'value', 'min', 'max', 'step'].includes(name)) node[name] = value;
      if (['hidden', 'disabled', 'checked', 'inert'].includes(name)) node[name] = true;
    }
    stack.at(-1).append(node);
    if (!['meta', 'link', 'input', 'br', 'img'].includes(tag)) stack.push(node);
  }
}
