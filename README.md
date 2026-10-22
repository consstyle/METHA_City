# MethaCity

Centro de control de agentes de METHABAU: una ciudad 3D donde cada edificio es una unidad de la empresa, alimentada (en solo lectura) por MethaDesk.

- **Plan:** `PLAN-DESARROLLO.md` y `PLAN-MethaCity.md` (carpeta `Methabau_Citi` en OneDrive).
- **Referencia visual:** `Methabau_Citi/preview/preview.html`.
- **Rumbo:** sistema operativo de agentes inspirado en NEXORA (plan v3, `PLAN-DESARROLLO.md`), con el MVP de frontend al final de F5.
- **Fase actual:** F3 (sistema y ciudad viva): carril de módulos, etiquetas con estado de agente, vista Hierarchie, panel de unidad y agente, Leitstand con simulación determinista. Siguiente: F4 (agentes y chat).

> No ejecutes `npm run build` mientras corre `npm run dev`: ambos usan `.next`. Las pruebas e2e usan su propia carpeta.

## Requisitos
- Node.js ≥ 22 (`.nvmrc`).
- Trabajar **fuera de OneDrive**: la sincronización de `node_modules` es lenta y da problemas (decisión D5).

## Comandos
| Comando | Qué hace |
|---|---|
| `npm install` | instala dependencias |
| `npm run dev -- -p 3100` | servidor de desarrollo en http://127.0.0.1:3100 |
| `npm run build` | compilación de producción |
| `npm run typecheck` | TypeScript estricto |
| `npm run lint` | ESLint |
| `npm test` | pruebas unitarias |
| `npm run test:coverage` | pruebas con cobertura (mínimo 80 % de líneas, ramas y funciones) |
| `npm run test:e2e` | pruebas e2e con Playwright (compila en `.next-e2e` y sirve en el puerto 3200; no interfiere con `npm run dev`). La primera vez: `npx playwright install chromium` |
| `npm run check` | todo lo anterior salvo la compilación |

## Escenarios del simulador
Mientras no hay backend, los datos salen de `src/data/mock` (indicadores del seed sintético del VPS de desarrollo). El escenario se elige con `?szenario=`:

| URL | Escenario |
|---|---|
| `/` | `normal`: datos del seed sintético |
| `/?szenario=alarme` | muchas alertas |
| `/?szenario=leer` | sin datos (la interfaz no muestra ceros falsos) |
| `/?szenario=fehler` | la fuente falla (mensaje genérico, detalle en el registro del servidor) |

El parámetro vale también en `/leitstand`.

## Agentes simulados (hasta B4)
Los 9 agentes (el orquestador «Methabau Chief» y uno por unidad) los mueve un motor determinista en el navegador (`src/os/simulation`, semilla fija, un paso cada 2,5 s mientras la pestaña está visible). Todo lo que sale de él lleva la marca **SIMULATION**. En B4 se sustituye por `HermesGateway` sin cambiar los componentes.

## Módulos
| Ruta | Módulo | Fase |
|---|---|---|
| `/` | Stadt: ciudad 3D (o Hierarchie) y panel de unidad con su agente | F3 |
| `/leitstand` | Leitstand: agentes, actividad, estado del sistema y alertas de MethaDesk | F3 |
| — | Agenten, Chat · Missionen, Aufgaben, Freigaben, Aktivität | F4 · F5 (marcados «BALD») |

## Estructura
```
src/
  app/(os)/                  armazón del sistema (cabecera, carril de módulos) y rutas de los módulos
  app/os.css                 estilos del sistema (carril, etiquetas, jerarquía, panel, Leitstand)
  components/                cabecera, pestañas de vista, carril de módulos
  os/                        contrato de agentes y actividad (zod), motor de simulación, store y proveedor
  features/city/model/       campus.ts (8 unidades, posiciones de preview.html), jerarquía, departamentos
  features/city/scene/       escena 3D: builder/, cámara, luz, balizas de agente, proyección de etiquetas
  features/city/overlay/     etiquetas, Hierarchie, controles de cámara, barra de herramientas, leyenda
  features/city/state/       estado compartido escena ↔ panel (zustand)
  features/city/panel/       panel de unidad: agente, MethaDesk, árbol de estructura
  features/cockpit/          Leitstand
  data/                      contrato (zod), agregación departamentos → unidad, carga, simulador de datos
  i18n/                      textos de la interfaz (solo alemán)
  lib/                       fechas en Europe/Zurich, tiempo relativo, congelado profundo
```

## Idioma
La interfaz está **solo en alemán**, como MethaDesk, con ortografía suiza («ss» en lugar de «ß»; una prueba lo comprueba). Todos los textos están en `src/i18n/de.ts`; ningún componente lleva texto escrito a mano. Los comentarios del código y la documentación siguen en español.
