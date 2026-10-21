import { z } from 'zod';
import { ABTEILUNG_IDS, UNIT_IDS } from '@/features/city/model/types';

/**
 * Contrato de datos entre la interfaz y su fuente (simulador ahora, API en la fase B1).
 * Todo lo que llega se valida en `loadSnapshot` con CitySnapshotSchema, venga de donde venga.
 *
 * Notas para la API (B1), que lee las vistas mc.* con node-postgres:
 *  - `count(*)` llega como texto (bigint): por eso los recuentos de entrada aceptan «123».
 *  - Las columnas `date` deben seleccionarse como texto (`naechster_montagetermin::text`) o
 *    registrar `types.setTypeParser(1082, v => v)`: si llegan como Date a medianoche local y se
 *    convierten con toISOString(), la fecha puede correrse un día.
 *  - `mc.projekt_kennzahlen` incluye proyectos archivados: filtrarlos en la consulta.
 */

/** Recuento de entrada: número o texto de dígitos. null, '' o true no se convierten en 0/1. */
const inCount = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .pipe(z.coerce.number().int().nonnegative());
/** Recuento ya validado (contrato hacia la interfaz). */
const count = z.number().int().nonnegative();

/** Fecha AAAA-MM-DD que existe de verdad (rechaza 2026-02-31 o 2026-13-45). */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'fecha inexistente');

/** Instante ISO; acepta desplazamiento (timestamptz de Postgres: «…+02:00»). */
const isoInstant = z.string().datetime({ offset: true });

/** Una fila de la vista mc.abteilung_kennzahlen (sql/03_vistas_indicadores.sql). */
export const AbteilungKennzahlenSchema = z.object({
  abteilung_id: z.enum(ABTEILUNG_IDS),
  ts_gesamt: inCount,
  ts_offen: inCount,
  ts_in_planung: inCount,
  ts_offen_status: inCount,
  ts_in_arbeit: inCount,
  ts_bestellt: inCount,
  ts_fertig: inCount,
  ts_teilgeliefert: inCount,
  ts_geliefert: inCount,
  ts_verbaut: inCount,
  ts_nachbearbeitung: inCount,
  ts_express: inCount,
  montage_ueberfaellig: inCount,
  plan_ueberfaellig: inCount,
  lieferung_ueberfaellig: inCount,
  montage_naechste_14_tage: inCount,
  abruf_aktiv: inCount,
  naechster_montagetermin: isoDate.nullable(),
  gruppen_offen: inCount,
  gruppen_in_arbeit: inCount,
  gruppen_fertig: inCount,
  /** La vista siempre devuelve los 12 departamentos; false = los ceros son relleno, no datos. */
  hat_daten: z.boolean(),
});
export type AbteilungKennzahlen = z.infer<typeof AbteilungKennzahlenSchema>;

/** Una fila de la vista mc.projekt_kennzahlen. */
export const ProjektKennzahlenSchema = z.object({
  projektId: z.string().min(1),
  projektnummer: z.string(),
  projektname: z.string().nullable(),
  archived: z.boolean(),
  ts_gesamt: inCount,
  ts_verbaut: inCount,
  ts_nachbearbeitung: inCount,
  ts_express: inCount,
  ts_verbaut_prozent: z
    .union([z.number(), z.string().regex(/^\d+(\.\d+)?$/)])
    .pipe(z.coerce.number().min(0).max(100))
    .nullable(),
  montage_ueberfaellig: inCount,
  abruf_aktiv: inCount,
  naechster_montagetermin: isoDate.nullable(),
});
export type ProjektKennzahlen = z.infer<typeof ProjektKennzahlenSchema>;

export const AgentStateSchema = z.object({
  state: z.enum(['offline', 'idle', 'working']),
  pendingApprovals: count,
});
export type AgentState = z.infer<typeof AgentStateSchema>;

export const DepartmentBreakdownSchema = z.object({
  abteilungId: z.enum(ABTEILUNG_IDS),
  present: z.boolean(),
  tsTotal: count,
  tsOffen: count,
  montageUeberfaellig: count,
  nachbearbeitung: count,
});
export type DepartmentBreakdown = z.infer<typeof DepartmentBreakdownSchema>;

export const UnitStatusSchema = z.object({
  unitId: z.enum(UNIT_IDS),
  /** false cuando ninguno de sus departamentos tiene datos: la interfaz no debe mostrar ceros. */
  hasData: z.boolean(),
  ts: z.object({
    total: count, offen: count, inPlanung: count, offenStatus: count, inArbeit: count, bestellt: count,
    fertig: count, teilgeliefert: count, geliefert: count, verbaut: count,
    nachbearbeitung: count, express: count,
  }),
  alerts: z.object({
    montageUeberfaellig: count, planUeberfaellig: count, lieferungUeberfaellig: count,
    nachbearbeitung: count, express: count, abrufAktiv: count, montageNaechste14Tage: count,
  }),
  naechsterMontagetermin: isoDate.nullable(),
  gruppen: z.object({ offen: count, inArbeit: count, fertig: count }),
  departments: z.array(DepartmentBreakdownSchema),
  agent: AgentStateSchema,
});
export type UnitStatus = z.infer<typeof UnitStatusSchema>;

export const ProjectStatusSchema = z.object({
  projektId: z.string().min(1),
  projektnummer: z.string(),
  projektname: z.string(),
  tsTotal: count,
  tsVerbaut: count,
  verbautProzent: z.number().min(0).max(100).nullable(),
  montageUeberfaellig: count,
  nachbearbeitung: count,
  express: count,
  abrufAktiv: count,
  naechsterMontagetermin: isoDate.nullable(),
});
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const CitySnapshotSchema = z
  .object({
    source: z.enum(['mock', 'live']),
    generatedAt: isoInstant,
    /** Momento de los datos de origen (mc.meta.abgefragt_am); null si se desconoce. */
    dataAsOf: isoInstant.nullable(),
    units: z.array(UnitStatusSchema),
    projects: z.array(ProjectStatusSchema),
  })
  .superRefine((snap, ctx) => {
    const ids = snap.units.map((u) => u.unitId);
    const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (repeated.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['units'], message: `unidad repetida: ${repeated.join(', ')}` });
    }
  });
export type CitySnapshot = z.infer<typeof CitySnapshotSchema>;

export interface GetSnapshotOptions {
  readonly signal?: AbortSignal;
}

export interface CityDataSource {
  getSnapshot(options?: GetSnapshotOptions): Promise<CitySnapshot>;
}

/**
 * Valida las filas de una en una: una fila inválida o un departamento nuevo en MethaDesk
 * (id desconocido) se descarta con un aviso en el registro, sin tumbar toda la ciudad.
 * Si un departamento llega repetido, gana la primera fila.
 */
export function parseAbteilungRows(raw: readonly unknown[]): AbteilungKennzahlen[] {
  const seen = new Set<string>();
  return raw.flatMap((row, index) => {
    const parsed = AbteilungKennzahlenSchema.safeParse(row);
    if (!parsed.success) {
      console.warn(`[city] fila ${index} de mc.abteilung_kennzahlen descartada:`, parsed.error.issues[0]?.message);
      return [];
    }
    if (seen.has(parsed.data.abteilung_id)) {
      console.warn(`[city] departamento repetido en mc.abteilung_kennzahlen: ${parsed.data.abteilung_id}`);
      return [];
    }
    seen.add(parsed.data.abteilung_id);
    return [parsed.data];
  });
}
