/** Small native form adapter. Reads only declared fields into an owned draft;
 * identifiers, exact media pins and other advanced fields remain unchanged. */
export function guidedFields(container, prefix) {
  const document = container.ownerDocument;
  const reads = [];
  const node = (tag, text) => {
    const value = document.createElement(tag);
    if (text !== undefined) value.textContent = text;
    return value;
  };
  const put = (draft, path, value) => {
    let owner = draft;
    for (const key of path.slice(0, -1)) owner = owner[key];
    owner[path.at(-1)] = value;
  };
  function field(parent, label, path, value, { lines = false, options = null } = {}) {
    const row = node('label', label),
      input = node(options ? 'select' : lines ? 'textarea' : 'input');
    input.setAttribute(`data-${prefix}-field`, path.join('.'));
    if (!options) input.maxLength = lines && Array.isArray(value) ? 12 * 2049 : 2048;
    if (lines) input.rows = 3;
    if (options)
      for (const item of options) {
        const option = node('option', item.label);
        option.value = item.value;
        input.append(option);
      }
    input.value = Array.isArray(value) ? value.join('\n') : (value ?? '');
    row.append(input);
    parent.append(row);
    reads.push((draft) =>
      put(
        draft,
        path,
        Array.isArray(value) ? input.value.split('\n').filter((line) => line.trim()) : input.value,
      ),
    );
    return input;
  }
  return {
    node,
    field,
    read(draft) {
      for (const read of reads) read(draft);
      return draft;
    },
  };
}
