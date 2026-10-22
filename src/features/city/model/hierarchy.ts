import { ABTEILUNG_IDS, type AbteilungId, type DistrictId, type RelationDef, type UnitDef } from './types';
import { CAMPUS_COORDINATION, PROJECT_DEPARTMENTS } from './campus';

const byCode = (a: UnitDef, b: UnitDef) => a.code.localeCompare(b.code);

export function unitById(units: readonly UnitDef[], id: string): UnitDef | undefined {
  return units.find((u) => u.id === id);
}

export function childrenOf(units: readonly UnitDef[], id: string): UnitDef[] {
  return units.filter((u) => u.parent === id).sort(byCode);
}

export function ancestorsOf(units: readonly UnitDef[], id: string): UnitDef[] {
  const chain: UnitDef[] = [];
  let current = unitById(units, id);
  while (current?.parent && chain.length < units.length) {
    const parent = unitById(units, current.parent);
    if (!parent) break;
    chain.push(parent);
    current = parent;
  }
  return chain;
}

export function unitsByDistrict(units: readonly UnitDef[], district: DistrictId): UnitDef[] {
  return units.filter((u) => u.district === district).sort(byCode);
}

/** Departamentos de MethaDesk de la unidad y de sus subunidades, en ese orden. */
export function departmentsOf(unit: UnitDef): AbteilungId[] {
  return [...unit.methadesk, ...unit.subunits.flatMap((s) => s.methadesk)];
}

export function deriveRelations(
  units: readonly UnitDef[],
  coordination: readonly { from: string; to: string }[] = CAMPUS_COORDINATION,
): RelationDef[] {
  const hierarchy = [...units]
    .sort(byCode)
    .flatMap((u) => (u.parent ? [{ from: u.parent, to: u.id, kind: 'hierarchy' as const }] : []));
  const links = coordination.flatMap((c) => {
    const from = unitById(units, c.from);
    const to = unitById(units, c.to);
    return from && to ? [{ from: from.id, to: to.id, kind: 'coordination' as const }] : [];
  });
  return [...hierarchy, ...links];
}

/** Altura del punto de anclaje de la etiqueta, como en preview.html. */
export function labelAnchorHeight(unit: UnitDef): number {
  const h = unit.size.h;
  switch (unit.archetype) {
    case 'tower': return 10.5;
    case 'terrace': return 7.75;
    case 'site': return 4;
    case 'office': return h + 1.1;
    case 'sawtooth': return h + 1.25;
    case 'factory':
    case 'logistics': return h + 1.05;
  }
}

function duplicates(values: readonly string[]): string[] {
  return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
}

function structureProblems(units: readonly UnitDef[]): string[] {
  return units.flatMap((u) => {
    if (u.parent === null) return u.level === 0 ? [] : [`${u.id}: una raíz debe tener nivel 0`];
    const parent = unitById(units, u.parent);
    if (!parent) return [`${u.id}: padre inexistente (${u.parent})`];
    const problems: string[] = [];
    if (parent.district !== u.district) problems.push(`${u.id}: su padre ${parent.id} está en otro distrito`);
    if (u.level !== parent.level + 1) problems.push(`${u.id}: el nivel debe ser ${parent.level + 1}`);
    return problems;
  });
}

/** Señala solo las unidades que forman parte de un ciclo (no las que cuelgan de él). */
function cycleProblems(units: readonly UnitDef[]): string[] {
  return units.flatMap((u) => {
    let current = u.parent ? unitById(units, u.parent) : undefined;
    for (let steps = 0; current && steps < units.length; steps++) {
      if (current.id === u.id) return [`${u.id}: ciclo en la jerarquía`];
      current = current.parent ? unitById(units, current.parent) : undefined;
    }
    return [];
  });
}

function linkProblems(units: readonly UnitDef[], coordination: readonly { from: string; to: string }[]): string[] {
  return coordination.flatMap(({ from, to }) =>
    [from, to].filter((id) => !unitById(units, id)).map((id) => `coordinación ${from} ↔ ${to}: unidad inexistente ${id}`),
  );
}

function subunitProblems(units: readonly UnitDef[]): string[] {
  const ids = units.flatMap((u) => u.subunits.map((s) => s.id));
  return duplicates(ids).map((id) => `subunidad repetida: ${id}`);
}

function coverageProblems(units: readonly UnitDef[], requireFullCoverage: boolean): string[] {
  const assigned = units.flatMap(departmentsOf);
  const repeated = duplicates(assigned).map((d) => `departamento ${d} asignado a más de una unidad`);
  // Los departamentos de obra pertenecen a los proyectos (F5c), no a un edificio del campus.
  const missing = requireFullCoverage
    ? ABTEILUNG_IDS.filter((d) => !assigned.includes(d) && !PROJECT_DEPARTMENTS.includes(d)).map((d) => `departamento ${d} sin asignar`)
    : [];
  return [...repeated, ...missing];
}

/** Devuelve la lista de problemas del modelo; vacía si es coherente. */
export function validateCampus(
  units: readonly UnitDef[],
  {
    requireFullCoverage = true,
    coordination = CAMPUS_COORDINATION,
  }: { requireFullCoverage?: boolean; coordination?: readonly { from: string; to: string }[] } = {},
): string[] {
  return [
    ...duplicates(units.map((u) => u.id)).map((id) => `id duplicado: ${id}`),
    ...duplicates(units.map((u) => u.code)).map((c) => `código duplicado: ${c}`),
    ...structureProblems(units),
    ...cycleProblems(units),
    ...linkProblems(units, coordination),
    ...subunitProblems(units),
    ...coverageProblems(units, requireFullCoverage),
  ];
}
