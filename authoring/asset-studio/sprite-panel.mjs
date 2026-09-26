import { t, localizedText, localizedAttribute } from '../../game/i18n/index.mjs';
import { createSpriteEditor, spriteDocument } from '../../game/presentation/sprite-editor.mjs';
import { hexColor, rgbHex } from './helpers.mjs';
export function mountSpritePanel({ onPrepare, onError, runOperation }) {
  const $ = (id) => document.getElementById(id),
    canvas = $('sprite-canvas'),
    ctx = canvas.getContext('2d');
  let baseline = null;
  let editor = null,
    cursor = [0, 0],
    selection = null,
    stroke = null,
    anchor = null;
  const color = () => hexColor($('sprite-color').value, $('sprite-alpha').value);
  function draw() {
    if (!editor) return;
    const doc = editor.snapshot();
    canvas.width = doc.width;
    canvas.height = doc.height;
    canvas.style.width = `${doc.width * Number($('sprite-zoom').value)}px`;
    canvas.style.height = `${doc.height * Number($('sprite-zoom').value)}px`;
    ctx.putImageData(new ImageData(doc.pixels, doc.width, doc.height), 0, 0);
    if (stroke && ['pencil', 'eraser'].includes($('sprite-tool').value)) {
      ctx.fillStyle = $('sprite-tool').value === 'eraser' ? '#425563' : $('sprite-color').value;
      for (const point of stroke) ctx.fillRect(...point, 1, 1);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.3;
    if (selection) ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
    if (document.activeElement === canvas)
      ctx.strokeRect(cursor[0] + 0.15, cursor[1] + 0.15, 0.7, 0.7);
    const history = editor.history(),
      undo = $('sprite-undo'),
      redo = $('sprite-redo'),
      focused = document.activeElement;
    // Hand off owned endpoint focus before native disabling loses it. Canvas
    // shortcuts and newer focus elsewhere remain with their existing owner.
    if (focused === undo && !history.undo) {
      redo.disabled = !history.redo;
      (history.redo ? redo : canvas).focus();
    } else if (focused === redo && !history.redo) {
      undo.disabled = !history.undo;
      (history.undo ? undo : canvas).focus();
    }
    undo.disabled = !history.undo;
    redo.disabled = !history.redo;
    localizedText($('sprite-cursor'), () =>
      t('tools:studio.sprite.cursor', {
        width: doc.width,
        height: doc.height,
        cursor: cursor.join(', '),
        selection: selection
          ? t('tools:studio.sprite.selection', {
              width: selection.width,
              height: selection.height,
            })
          : '',
        anchor: anchor ? ` ${t('tools:chooseTheEndPointThenSpace')}` : '',
      }),
    );
  }
  function guarded(fn) {
    try {
      fn();
      draw();
    } catch (error) {
      onError(error);
    }
  }
  function apply(start, end, points = [end]) {
    const tool = $('sprite-tool').value;
    if (tool === 'picker') {
      const sampled = editor.pixel(...end);
      $('sprite-color').value = rgbHex(sampled);
      $('sprite-alpha').value = sampled[3];
    } else if (tool === 'selection')
      selection = {
        x: Math.min(start[0], end[0]),
        y: Math.min(start[1], end[1]),
        width: Math.abs(end[0] - start[0]) + 1,
        height: Math.abs(end[1] - start[1]) + 1,
      };
    else if (tool === 'fill') editor.fill(...end, color());
    else if (tool === 'line') editor.line(...start, ...end, color());
    else if (tool.includes('rectangle'))
      editor.rectangle(...start, ...end, color(), tool === 'filled-rectangle');
    else editor.stroke(points, tool === 'eraser' ? [0, 0, 0, 0] : color());
  }
  const position = (event) => {
    const box = canvas.getBoundingClientRect();
    return [
      Math.max(
        0,
        Math.min(
          canvas.width - 1,
          Math.floor(((event.clientX - box.left) * canvas.width) / box.width),
        ),
      ),
      Math.max(
        0,
        Math.min(
          canvas.height - 1,
          Math.floor(((event.clientY - box.top) * canvas.height) / box.height),
        ),
      ),
    ];
  };
  canvas.addEventListener('pointerdown', (event) => {
    if (!editor || event.button !== 0) return;
    event.preventDefault();
    canvas.focus();
    canvas.setPointerCapture(event.pointerId);
    cursor = position(event);
    stroke = [cursor];
    draw();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!stroke) return;
    cursor = position(event);
    if (stroke.length < 16384) stroke.push(cursor);
    draw();
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!stroke) return;
    cursor = position(event);
    const points = stroke;
    stroke = null;
    guarded(() => apply(points[0], cursor, [...points, cursor]));
  });
  canvas.addEventListener('pointercancel', () => {
    stroke = null;
    draw();
  });
  canvas.addEventListener('keydown', (event) => {
    if (!editor) return;
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (directions[event.key]) {
      event.preventDefault();
      const d = directions[event.key];
      cursor = [
        Math.max(0, Math.min(canvas.width - 1, cursor[0] + d[0])),
        Math.max(0, Math.min(canvas.height - 1, cursor[1] + d[1])),
      ];
      draw();
    } else if (event.code === 'Space') {
      event.preventDefault();
      guarded(() => {
        const multi = ['line', 'rectangle', 'filled-rectangle', 'selection'].includes(
          $('sprite-tool').value,
        );
        if (multi && !anchor) anchor = [...cursor];
        else {
          apply(anchor || cursor, cursor);
          anchor = null;
        }
      });
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      guarded(() => (event.shiftKey ? editor.redo() : editor.undo()));
    } else if (event.key === 'Escape') {
      anchor = null;
      selection = null;
      draw();
    }
  });
  canvas.addEventListener('focus', draw);
  canvas.addEventListener('blur', draw);
  $('sprite-zoom').addEventListener('change', draw);
  $('sprite-tool').addEventListener('change', () => {
    anchor = null;
  });
  $('sprite-undo').onclick = () => guarded(() => editor.undo());
  $('sprite-redo').onclick = () => guarded(() => editor.redo());
  document.querySelectorAll('[data-transform]').forEach(
    (button) =>
      (button.onclick = () =>
        guarded(() => {
          editor.transform(button.dataset.transform);
          cursor = [0, 0];
          selection = null;
        })),
  );
  $('replace-palette-color').onclick = () =>
    guarded(() => editor.replaceColor(hexColor($('replace-color').value), color()));
  $('move-selection').onclick = () =>
    guarded(() => {
      if (!selection) throw new Error(t('tools:selectARectangleOnTheCanvasFirst'));
      const dx = Number($('selection-dx').value),
        dy = Number($('selection-dy').value);
      editor.moveSelection(selection, dx, dy);
      selection.x += dx;
      selection.y += dy;
    });
  $('use-sprite').onclick = () =>
    runOperation(t('tools:encodingTheEditedSprite'), async (task) => {
      const doc = editor.snapshot(),
        output = document.createElement('canvas');
      output.width = doc.width;
      output.height = doc.height;
      output.getContext('2d').putImageData(new ImageData(doc.pixels, doc.width, doc.height), 0, 0);
      const blob = await new Promise((resolve) => output.toBlob(resolve, 'image/png'));
      task.check();
      if (!blob) throw new Error(t('tools:theBrowserCouldNotEncodeThisSprite'));
      await onPrepare(blob, task);
    });
  return {
    hasEdits() {
      if (!editor || !baseline) return false;
      const current = editor.snapshot();
      return (
        current.width !== baseline.width ||
        current.height !== baseline.height ||
        current.pixels.some((value, index) => value !== baseline.pixels[index])
      );
    },
    acceptSnapshot() {
      baseline = editor?.snapshot() || null;
    },
    reset() {
      editor = null;
      baseline = null;
      $('sprite-workbench').hidden = true;
    },
    open(width, height, pixels) {
      editor = createSpriteEditor(spriteDocument(width, height, pixels));
      baseline = editor.snapshot();
      cursor = [0, 0];
      anchor = null;
      selection = null;
      $('sprite-workbench').hidden = false;
      draw();
    },
    setPalette(palette) {
      $('sprite-palette').replaceChildren(
        ...palette.map((hex) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.style.background = hex;
          localizedAttribute(b, 'title', () => t('tools:studio.sprite.useColor', { color: hex }));
          localizedAttribute(b, 'aria-label', () =>
            t('tools:studio.sprite.useColor', { color: hex }),
          );
          b.onclick = () => {
            $('sprite-color').value = hex;
          };
          return b;
        }),
      );
    },
  };
}
