const RTF = new Intl.RelativeTimeFormat('de-CH', { numeric: 'auto', style: 'short' });

/** «gerade eben», «vor 2 Min.», «vor 3 Std.», «vorgestern»… para la actividad de los agentes. */
export function relativeTimeDe(iso: string, now: Date): string {
  const seconds = (now.getTime() - Date.parse(iso)) / 1000;
  if (seconds < 45) return 'gerade eben';
  if (seconds < 3600) return RTF.format(-Math.round(seconds / 60), 'minute');
  if (seconds < 86_400) return RTF.format(-Math.round(seconds / 3600), 'hour');
  return RTF.format(-Math.round(seconds / 86_400), 'day');
}
