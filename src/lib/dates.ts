const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ZURICH_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Fecha de hoy (AAAA-MM-DD) en Zúrich: MethaDesk y las vistas mc.* trabajan en esa zona. */
export function todayInZurich(now: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    ZURICH_PARTS.formatToParts(now).find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Hora HH:MM (0–23) en Zúrich de un instante ISO, para «Datenstand …». */
export function timeInZurich(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(iso));
}

/** Suma (o resta) días a una fecha AAAA-MM-DD existente. */
export function addDaysIso(iso: string, days: number): string {
  const match = ISO_DATE.exec(iso);
  const base = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!base || base.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Fecha no válida: se espera una fecha AAAA-MM-DD existente (${iso})`);
  }
  return new Date(base.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}
