// Genera replica/10_schema.sql: réplica del esquema de MethaDesk para el entorno de desarrollo.
//
// Uso (sin dependencias):
//   node tools/build-replica-schema.mjs "<ruta al repo MethaDesk>"
//
// Fuente: easypanel-public.sql (reconstrucción del esquema de producción con pg_get_*def)
// más las migraciones posteriores que añaden las tablas y columnas que usan las vistas de
// ../../sql. Es el mínimo necesario para probar MethaCity, no una copia completa de MethaDesk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = process.argv[2] ?? process.env.METHADESK_REPO;
if (!repo) {
  console.error('Falta la ruta del repositorio de MethaDesk (argumento o METHADESK_REPO).');
  process.exit(1);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'replica', '10_schema.sql');

const MIGRACIONES = [
  '20260912_terminkette', '20260920_termine_manuell', '20260920_nachbearbeitung_erledigt',
  '20261001_teilsysteme_bauleitung_erledigt', '20261001_teilsysteme_fertigung',
  '20261005_teilsysteme_neu_autor', '20261005_teilsysteme_plan_fertig_zeitpunkt',
  '20261002_teilsystem_abrufe', '20261004_abruf_positionen',
  '20261021_projekte_mehrere_verantwortliche', '20260911_edit_pages_missing_columns',
  '20261008_teilsystem_gruppen', '20260904_abteilungen', '20261007_ausfuehrung_tasks_vorgaenge',
  '20260924_lagerbewegungen_details', '20260917_users_alle_projekte_ansicht',
  '20261014_users_notfall_login', '20260903_teams_add_abteilung', '20260809140000_add_montage_dauer',
];

const read = (p) => fs.readFileSync(p, 'utf8');
const snapshot = read(path.join(repo, 'easypanel-public.sql')).split(/\r?\n/);

// Las 9 primeras líneas del snapshot son la cabecera (DROP/CREATE SCHEMA public, owner, grant):
// la réplica vive en una base de datos nueva cuyo esquema public ya existe y pertenece al
// propietario (md_owner). Se conserva solo el GRANT sobre el esquema.
const cuerpo = snapshot.slice(9).join('\n');

const partes = [
  '-- ============================================================================',
  '-- 10_schema.sql  ·  réplica del esquema de MethaDesk (GENERADO, no editar a mano)',
  '-- Generado por tools/build-replica-schema.mjs a partir de easypanel-public.sql y',
  `-- ${MIGRACIONES.length} migraciones de MethaDesk. Ejecutar como md_owner en la base \`methadesk\`.`,
  '-- ============================================================================',
  '\\set ON_ERROR_STOP on',
  'GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;',
  '',
  cuerpo,
];
for (const m of MIGRACIONES) {
  partes.push('', `-- ── migración ${m} ──`, read(path.join(repo, 'supabase', 'migrations', `${m}.sql`)));
}
partes.push(
  '',
  '-- ── extra de la réplica ──',
  '-- bestellungen.liefertermin figura en el tipo MaterialBestellung (src/types/index.ts) pero no en',
  '-- el snapshot de producción; se añade para poder probar las vistas con ella.',
  'ALTER TABLE public.bestellungen ADD COLUMN IF NOT EXISTS liefertermin TEXT;',
);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, partes.join('\n') + '\n', 'utf8');
process.stdout.write(`escrito ${out} (${fs.statSync(out).size} bytes, ${MIGRACIONES.length} migraciones)\n`);
