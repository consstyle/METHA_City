import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutLabels, type LabelInput } from './labelLayout';

const VIEW = { width: 1200, height: 800 };
const label = (id: string, x: number, y: number, priority = 0, onScreen = true): LabelInput => ({ id, anchorX: x, anchorY: y, w: 130, h: 39, priority, onScreen });

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < Math.max(a.h, b.h);
}

test('una etiqueta sola queda 8 px por encima de su anclaje con la línea guía hasta él', () => {
  const [l] = layoutLabels([label('avor', 600, 400)], VIEW, { selected: null });
  assert.equal(l?.visible, true);
  assert.deepEqual([l?.x, l?.y], [600, 392]);
  assert.equal(l?.leader, 'M600,393 L600,402 L600,409');
});

test('las etiquetas que caen en el mismo sitio no se solapan', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const out = layoutLabels(ids.map((id, i) => label(id, 600, 400, -i)), VIEW, { selected: null }).filter((l) => l.visible);
  assert.equal(out.length, ids.length);
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) assert.ok(!overlaps(out[i]!, out[j]!), `${out[i]!.id} solapa ${out[j]!.id}`);
  }
});

test('las etiquetas se mantienen dentro de la ventana y por debajo del título', () => {
  const out = layoutLabels([label('l', -50, 20), label('r', 1300, 790)], VIEW, { selected: null });
  for (const l of out.filter((x) => x.visible)) {
    assert.ok(l.x - l.w / 2 >= 6 && l.x + l.w / 2 <= VIEW.width - 6, `${l.id} x=${l.x}`);
    assert.ok(l.y >= 130 && l.y <= VIEW.height - 80, `${l.id} y=${l.y}`);
  }
});

test('la seleccionada se coloca primero y conserva su sitio', () => {
  const out = layoutLabels([label('a', 600, 400, 10), label('sel', 600, 400, 0)], VIEW, { selected: 'sel' });
  const sel = out.find((l) => l.id === 'sel');
  assert.deepEqual([sel?.x, sel?.y], [600, 392]);
});

test('las que están detrás de la cámara o muy fuera de pantalla se ocultan', () => {
  const out = layoutLabels([label('behind', 600, 400, 0, false), label('far', 5000, 400)], VIEW, { selected: null });
  assert.deepEqual(out.map((l) => [l.id, l.visible]), [['behind', false], ['far', false]]);
});

test('en pantallas estrechas solo se muestran las cabeceras y la seleccionada', () => {
  const narrow = { width: 500, height: 700 };
  const out = layoutLabels(
    [label('avor', 250, 300), label('einkauf', 100, 300), label('bau', 300, 400)],
    narrow,
    { selected: 'bau', compactAllow: ['avor', 'projektleitung', 'bauleitung'] },
  );
  assert.deepEqual(out.map((l) => [l.id, l.visible]), [['bau', true], ['avor', true], ['einkauf', false]]);
});
