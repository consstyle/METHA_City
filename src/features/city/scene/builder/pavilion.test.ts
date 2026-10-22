import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { PAVILION_LOTS, SPECIALISTS } from '@/features/city/model/specialists';
import { pavilionLayout } from './pavilion';

const unit = (id: string) => CAMPUS_UNITS.find((u) => u.id === id)!;

test('el pabellón mira a su unidad y el camino va hacia ella sin meterse en el edificio', () => {
  const lot = PAVILION_LOTS.find((l) => l.id === 'i5')!;
  const target = unit('planer');
  const layout = pavilionLayout(lot, target);
  const link = layout.parts.find((p) => p.key === 'link')!;
  const facing = Math.atan2(target.position.x - lot.x, target.position.z - lot.z);
  for (const p of layout.parts) assert.equal(p.rotationY, facing, p.key);
  const end = Math.hypot(link.position[0] - lot.x, link.position[2] - lot.z) + link.size[2] / 2;
  const reach = Math.max(target.size.w, target.size.d) / 2 + 0.5;
  assert.ok(end <= Math.hypot(target.position.x - lot.x, target.position.z - lot.z) - reach + 1e-9, 'el camino se detiene antes del pavimento');
});

test('todas las combinaciones solar × unidad del catálogo dan piezas con tamaño válido y baliza encima', () => {
  for (const s of SPECIALISTS) {
    for (const lot of PAVILION_LOTS.filter((l) => l.district === s.district)) {
      const layout = pavilionLayout(lot, unit(s.unitId));
      for (const p of layout.parts) assert.ok(p.size.every((v) => v >= 0 && Number.isFinite(v)), `${s.id}@${lot.id} ${p.key}`);
      assert.ok(layout.beacon[1] > layout.parts.find((p) => p.key === 'roof')!.position[1]);
      assert.ok(layout.top > layout.beacon[1]);
    }
  }
});
