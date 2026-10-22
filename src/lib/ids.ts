let sequence = 0;

/**
 * Sufijo para ids creados en el navegador: contador de la pestaña + parte aleatoria, para que dos
 * pestañas que crean algo en el mismo milisegundo no choquen. Solo [a-z0-9].
 */
export function uniqueSuffix(): string {
  const random = Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0');
  return `${(sequence++).toString(36)}${random}`;
}
