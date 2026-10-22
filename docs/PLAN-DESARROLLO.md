# MethaCity — Plan de desarrollo (v3): sistema operativo de agentes

> Sustituye a la v2 (2026-10-21). **Objetivo:** convertir la ciudad 3D en el sistema operativo de agentes de METHABAU, inspirado en NEXORA (el sistema del vídeo de Komputer Mechanic), con **el mismo diseño** que tenemos.
> **Prioridad:** un **MVP visible lo antes posible**: primero todo el frontend, con agentes simulados; después el backend real (Hermes, Supabase, MethaDesk).
> Referencia visual: [`preview/preview.html`](preview/preview.html). Referencia funcional: índice de 21 módulos de NEXORA (elaborado a partir de su documentación, no del vídeo fotograma a fotograma).

---

## 0. Dónde estamos

| Fase | Estado | Resultado |
|---|---|---|
| F0 · Base | ✅ | Next.js 15 + React 19 + TypeScript estricto, interfaz en alemán, cabeceras de seguridad |
| F1 · Modelo y contrato | ✅ | 8 unidades de preview.html, agregación de los 12 departamentos de MethaDesk, simulador de datos |
| F2 · Escena 3D | ✅ | Port fiel de preview.html con React Three Fiber: 124 llamadas de dibujo, cámara, rutas, tráfico, luz, selección. 108 pruebas unitarias y 10 e2e |
| F3 · Sistema y ciudad viva | ✅ `f07b553` | Carril de módulos, etiquetas con estado de agente, «Namen», Hierarchie, panel de unidad y agente, Leitstand, motor de simulación determinista, balizas (132 llamadas de dibujo). 133 pruebas unitarias (cobertura 97,7 %), 23 e2e (escritorio, móvil, sin WebGL) y axe sin fallos graves. Revisión de código aplicada |

| F4 · Agentes y chat | ✅ `10c3fc3` | Directorio y perfil, catálogo de 14 especialistas con Freigabe y 8 solares de pabellón, chat con respuestas guionizadas en streaming y `AgentGateway`. 188 pruebas unitarias (cobertura 98 %), 43 e2e y axe sin fallos graves. Revisión de código aplicada |

| F5 · Misiones, tareas, Freigaben y actividad · **MVP** | ✅ `3033912` | Planificador determinista, ciclo de vida por tiempo real con agentes ocupados en la ciudad, informe en Markdown, módulo Freigaben unificado, Kanban, Aktivität con diario persistente. 223 pruebas unitarias (cobertura 98 %), 58 e2e (incluido el flujo de aceptación) y axe sin fallos graves. Revisión de código aplicada |

| F5b · Demo en el VPS | ✅ `eb34437` (falta desplegar) | `Dockerfile` standalone sin privilegios, Basic Auth que falla cerrada y exige HTTPS, `/api/health`, runbook de Dokploy (`deploy/demo/README.md`), zip con `git archive`. Revisión de seguridad aplicada. Pendiente: que lo despliegues tú en el VPS |

Repositorio: https://github.com/consstyle/METHA_City (**público**; copia local en `C:\Users\f.martinez\methacity`). `main` = F5b (`eb34437`); ramas de cada fase también subidas. Desde ahora, este plan, `sql/`, `deploy/dev/` y `preview/` viven en el repositorio (la carpeta de OneDrive se retiró). `deploy/dev/replica/10_schema.sql` no se publica.

---

## 1. Principios

1. **El MVP manda.** Cada fase de frontend deja algo que se puede enseñar. El hito es el **MVP al final de F5**: navegar el sistema, ver la ciudad viva, hablar con agentes, lanzar una misión, aprobar su plan y verla ejecutarse.
2. **Mismo diseño.** Todos los módulos usan el lenguaje visual de preview.html: fondo `#101316`, paneles `#181c20`, naranja `#f26a21`, etiquetas monoespaciadas, tarjetas con borde fino. Nada de librerías de UI que lo cambien.
3. **Simulación honesta.** Hasta que exista el backend, los agentes los mueve un **motor de simulación** en el navegador, con la misma interfaz que luego implementará Hermes. Todo lo simulado lleva la marca «Simulation».
4. **Interfaz en alemán**, como MethaDesk (ortografía suiza). Documentación y conversación, en español.
5. **Las personas aprueban.** Ningún agente envía, compra, borra ni escribe en MethaDesk sin aprobación; el frontend lo refleja desde el primer día (bandeja de aprobaciones).

---

## 2. Los 21 módulos de NEXORA en MethaCity

| # | NEXORA | En MethaCity (nombre en la interfaz) | Prioridad | Fase |
|---|---|---|---|---|
| 1 | Cockpit | **Leitstand**: agentes activos e inactivos, misiones y tareas en curso, aprobaciones pendientes, actividad reciente, salud del sistema, alertas de MethaDesk | **MVP** | F3 |
| 2 | Agent City | **Stadt**: la ciudad actual con el estado de cada agente sobre su edificio (libre, trabajando, esperando aprobación), etiquetas y vista Hierarchie | **MVP** | F3 |
| 3 | Agent Management | **Agenten**: directorio, perfil (identidad, papel, responsabilidades, instrucciones permanentes, memoria, archivos, historial), catálogo de especialistas, contratar y retirar | **MVP** | F4 |
| 4 | EXECUTOR | **Orquestador** (D7): recibe la petición, propone un plan, delega en las unidades y consolida | **MVP** | F4–F5 |
| 5 | Missions | **Missionen**: objetivo, resultado esperado, plan, aprobación, ejecución paso a paso, informe final | **MVP** | F5 |
| 6 | Task Management | **Aufgaben**: tablero Kanban, asignación a agentes, delegación | **MVP** | F5 |
| 7 | Chat | **Chat** por agente y con el orquestador, historial persistente; adjuntos (interfaz) | **MVP** | F4 |
| 8 | Voice Mode | **Sprachmodus** | Opcional | F8 |
| 9 | Hand Mode | **Gestensteuerung** con cámara web | Opcional | F8 |
| 10 | Memory | **Gedächtnis**: memoria por agente y compartida, recordar y olvidar | V1 | F6 |
| 11 | Docs | **Dokumente**: informes de misiones (visor en el MVP), biblioteca completa en V1 | MVP parcial | F5 / F6 |
| 12 | Files | **Dateien**: espacios de trabajo de cada agente | V1 | F6 |
| 13 | Terminal | **Terminal** restringida: solo superadmin, comandos permitidos, auditada | V2 | F7 |
| 14 | Health | **System**: resumen en el Leitstand (MVP), página completa en V1 | MVP parcial | F3 / F6 |
| 15 | Activity Logs | **Aktivität**: registro y comunicaciones entre agentes | **MVP** | F5 |
| 16 | Schedules | **Zeitpläne**: tareas programadas y órdenes permanentes | V1 | F6 |
| 17 | Multi-Agent | Delegación visible en la ciudad (rutas que se iluminan) y en Aktivität | **MVP** | F5 |
| 18 | Settings | **Einstellungen**: apariencia dentro del diseño (luz, densidad, etiquetas) e identidades de agentes | V1 | F6 |
| 19 | Security | **Freigaben** (aprobaciones) en el MVP; roles y permisos con el backend | MVP parcial | F5 / B2 |
| 20 | Deployment | Imagen Docker + Dokploy; demo del MVP en el VPS | MVP | F5b |
| 21 | Architecture | Fases de backend B1–B6 | — | §6 |

**Lo propio de METHABAU** se mantiene: los indicadores de MethaDesk por unidad (contrato de F1) alimentan el Leitstand y el panel de cada agente; cada edificio es una unidad real de la empresa.

---

## 3. Decisiones

Ya tomadas: D1–D6 (v2): sin edificio propio para el orquestador, subunidades para los 4 departamentos sin edificio, paleta del HTML, interfaz solo en alemán, repositorio propio fuera de OneDrive y altura de los edificios según la jerarquía.

Nuevas, con recomendación (se aplican por defecto si no se cambian):

| # | Decisión | Recomendación |
|---|---|---|
| D7 | Nombre del orquestador | **«Methabau Chief»** (nombre propio, no «EXECUTOR»). Es un nombre de interfaz y se cambia en una línea. |
| D8 | Especialistas contratados en la ciudad | Catálogo de 14 papeles adaptados a METHABAU (§3.1). Cada especialista contratado aparece como **pabellón pequeño** en los solares libres de su distrito, conectado a la unidad que lo pide. |
| D9 | Navegación | Se mantiene la cabecera del HTML; se añade una **barra lateral de módulos** estrecha (iconos y etiqueta monoespaciada). **La pantalla de inicio es la Stadt**, con el resumen del Leitstand en el panel; el Leitstand completo tiene su propia página. |
| D10 | Motor del MVP | **Simulación determinista en el navegador**: respuestas y planes guionizados en alemán, sin LLM, con persistencia en `localStorage` para que sobreviva a una recarga. Conectar Hermes llega en B4. |
| D11 | Voz y gestos | Después del backend y opcionales. Los gestos usan la cámara web: solo bajo petición del usuario y sin enviar imágenes fuera del navegador. |
| D12 | Terminal | Solo superadmin, lista blanca de comandos de diagnóstico, todo auditado. Primero solo lectura. |

### 3.1 Catálogo de especialistas (D8, 14 papeles)
Kalkulation & Offerten · Terminplanung · Qualitätssicherung · Arbeitssicherheit · Dokumentation · Controlling · Personal · Lieferantenmanagement · Logistik-Disposition · BIM-Koordination · Nachkalkulation · Kundendienst · IT-Support · Recht & Verträge.

---

## 4. Arquitectura del frontend

### 4.1 Rutas y estructura

| Ruta | Módulo | Fase |
|---|---|---|
| `/` | Stadt (ciudad + panel con resumen del Leitstand) | F3 |
| `/leitstand` | Leitstand completo | F3 |
| `/agenten`, `/agenten/[id]` | Agenten y perfil | F4 |
| `/chat?agent=` | Chat | F4 |
| `/missionen`, `/missionen/[id]` | Missionen | F5 |
| `/aufgaben` | Aufgaben (Kanban) | F5 |
| `/freigaben` | Freigaben (aprobaciones) | F5 |
| `/aktivitaet` | Aktivität | F5 |
| `/dokumente`, `/dateien`, `/zeitplaene`, `/gedaechtnis`, `/system`, `/einstellungen` | Operación | F6 |
| `/terminal` | Terminal | F7 |

Un único layout de aplicación: cabecera del HTML + barra de módulos + contenido. El estado del sistema vive en un store compartido, así que la ciudad, el Leitstand y los módulos ven lo mismo.

### 4.2 Contrato y pasarela de agentes
- **Contrato** (zod, ampliando el de F1): `Agent`, `AgentRole`, `AgentState`, `Conversation`, `ChatMessage`, `Mission`, `MissionStep`, `Task`, `Approval`, `ActivityEvent`, `DocumentMeta`, `Schedule`, `HealthReport`.
- **`AgentGateway`**: interfaz única para hablar con los agentes (enviar mensaje y recibir respuesta en streaming, lanzar misión, aprobar o rechazar, contratar y retirar, suscribirse a eventos).
  - En el MVP la implementa **`SimulatedAgentGateway`**: temporizadores y guiones deterministas que producen eventos como lo hará Hermes.
  - En B4 la implementa **`HermesGateway`** (API del servidor + SSE). Ningún componente cambia.
- **Bus de eventos**: cada evento (agente empieza a trabajar, delega, pide aprobación, termina) actualiza el store. La ciudad lo pinta: baliza sobre el edificio, rutas que se encienden entre las unidades que se delegan trabajo.

### 4.3 Componentes del diseño
Panel, tarjeta, insignia, etiqueta monoespaciada, tabla, columna Kanban, línea de tiempo, burbuja de chat, indicador numérico. Todos con los tokens de preview.html y probados con Playwright y axe.

---

## 5. Fases del frontend (camino al MVP)

### F3 · Sistema y ciudad viva — *MVP 1/3*
- Barra de módulos, rutas base y diseño responsive.
- Ciudad: etiquetas con líneas guía y anti-solape (como en el HTML), conmutador «Namen», vista **Hierarchie** (organigrama) y **estado del agente sobre cada edificio**.
- Panel de unidad y agente: papel, descripción, «depende de», unidades a su cargo, árbol, puente de coordinación, «aus der Nähe ansehen», indicadores de MethaDesk, estado del agente y botón de chat.
- **Leitstand**: agentes activos e inactivos, misiones y tareas en curso, aprobaciones pendientes, actividad reciente, salud del sistema y alertas de MethaDesk.
- Motor de simulación básico (estados de agentes y actividad).
- **Aceptación:** navegación e2e entre módulos, Leitstand con datos simulados, etiquetas sin solapes en escritorio y móvil, axe sin fallos graves.

### F4 · Agentes y chat — *MVP 2/3*
- Directorio y perfil de agente (identidad, papel, responsabilidades, instrucciones permanentes, resumen de memoria, archivos, historial).
- Chat con cada agente y con el orquestador: lista de conversaciones, respuestas simuladas en streaming, historial persistente, adjuntos (interfaz).
- Catálogo de especialistas: contratar y retirar con aprobación; el pabellón aparece o desaparece en la ciudad.
- **Aceptación:** e2e de conversación y de contratación.

#### F4 en detalle (decisiones por defecto D13–D16)
| # | Decisión | Por defecto |
|---|---|---|
| D13 | Aprobación de contrataciones antes de F5 | La solicitud crea una **Freigabe pendiente** que se aprueba o rechaza en la propia página Agenten (y cuenta en el Leitstand). En F5 se traslada al módulo Freigaben sin cambiar el modelo. |
| D14 | Pabellones | **Solares fijos por distrito** (4 + 4), comprobados por una prueba contra edificios, calles, plazas y árboles. Sin solar libre en su distrito, el papel no se puede contratar («Kein Bauplatz frei»). |
| D15 | Persistencia | `localStorage` versionado y validado con zod (conversaciones, contrataciones, instrucciones permanentes). Si falta o está corrupto, se arranca limpio. |
| D16 | Adjuntos | Solo interfaz: se muestran nombre y tamaño, **no se lee ni se sube el contenido** hasta B5. |

Piezas:
1. **Contrato y catálogo**: `Conversation`, `ChatMessage`, `Hire`, `Approval` (zod); catálogo de los 14 especialistas (distrito y unidad que los pide); solares de pabellón.
2. **Motor**: plantilla dinámica de agentes (contratar y retirar), los especialistas trabajan y reciben delegaciones de su unidad.
3. **`AgentGateway` + `SimulatedAgentGateway`**: respuestas guionizadas en alemán según agente y palabras clave (estado, tareas, MethaDesk, ayuda), entregadas en streaming palabra a palabra y cancelables.
4. **Agenten** (`/agenten`): directorio filtrable (Alle · Einheiten · Spezialisten) y catálogo con solicitud, aprobación y retirada.
5. **Perfil** (`/agenten/[id]`): identidad, papel, responsabilidades, instrucciones permanentes (editables), resumen de memoria, archivos e historial.
6. **Chat** (`/chat?agent=`): lista de conversaciones, hilo con burbujas, streaming con «Stopp», nueva conversación, adjuntos (D16).
7. **Ciudad**: pabellón con baliza y enlace a su unidad; botón «Chat öffnen» del panel activo; carril con Agenten y Chat.

### F5 · Misiones, tareas, aprobaciones y actividad — *MVP 3/3* · **Hito MVP**
- **Missionen**: objetivo, resultado esperado y extensión del informe → el orquestador propone un plan → **Freigaben** → ejecución paso a paso (Pending → Working → Done), con los agentes trabajando en la ciudad y las rutas de delegación encendidas → informe en Dokumente.
- **Aufgaben**: Kanban (Offen · In Arbeit · Wartet auf Freigabe · Erledigt) con asignación a agentes.
- **Aktivität**: registro filtrable y comunicaciones entre agentes.
- **Freigaben**: planes, resultados y borradores, con historial de decisiones.
- **Aceptación:** e2e completo «misión → aprobar plan → ejecución → aprobar resultado → informe».

#### F5 en detalle (decisiones por defecto D17–D21)
| # | Decisión | Por defecto |
|---|---|---|
| D17 | Planificador del MVP | **Determinista**: el Chief elige las unidades (y los especialistas contratados) por palabras clave del objetivo; plan de 3 a 6 pasos, cada uno asignado a un agente. Sin LLM. |
| D18 | Ejecución | Por **tiempo real** (un paso ≈ 5 s), así una misión sigue donde iba tras recargar. El agente del paso aparece «trabajando» en la ciudad con el texto del paso y la ruta de delegación se enciende. |
| D19 | Freigaben | **Un único módulo** para planes, resultados, contrataciones y retiradas, con historial de decisiones. Agenten deja de decidirlas (D13 termina). Rechazar un resultado añade un paso de revisión del Chief. |
| D20 | Aufgaben | Kanban de 4 columnas. Las tareas manuales se mueven con botones (teclado) o arrastrando; los pasos de misión aparecen solos y siguen el estado de la misión (no se mueven a mano). |
| D21 | Informe y Aktivität | El informe se guarda en la misión (vista y descarga en Markdown) hasta Dokumente (F6). Aktivität une la actividad en vivo con un diario persistente (misiones, Freigaben, contrataciones), filtrable por agente, tipo y texto. |

### F5b · Demo del MVP en el VPS
Imagen Docker (`output: standalone`), servicio en Dokploy, acceso con usuario y contraseña temporales y datos simulados. Sesión de comentarios con los responsables.

| # | Decisión | Por defecto |
|---|---|---|
| D22 | Acceso | **Basic Auth en la propia app** (usuario y contraseña temporales por variables de entorno en Dokploy) sobre HTTPS de Traefik. La imagen **falla cerrada**: sin credenciales responde 503. `noindex` y `robots.txt` cerrado. |
| D23 | Cómo llega el código al VPS | Sin remoto Git (no se sube a GitHub): **zip con `git archive`** subido a Dokploy («Drop») con build por Dockerfile. Alternativa: copiar por SSH y `docker compose` con las etiquetas de Traefik de Dokploy. |
| D24 | Vida de la demo | Solo datos simulados. Tras la sesión de comentarios se cambia la contraseña o se para el servicio. Cada navegador guarda sus propios datos (localStorage): no hay datos compartidos entre usuarios. |

### F6 · Operación — *V1*
Dokumente (biblioteca: ver, editar, descargar, borrar), Dateien (espacios de trabajo), Zeitpläne y órdenes permanentes, Gedächtnis (individual y compartida), System (salud completa) y Einstellungen.

### F7 · Administración — *V2*
Terminal restringida (D12), página de seguridad (roles y permisos), exportación de auditoría.

### F8 · Interacción avanzada — *opcional*
Sprachmodus (voz local tipo Piper o Kokoro, ElevenLabs opcional), Gestensteuerung (detección de manos en el navegador, bajo petición), espejo de Telegram en el chat.

---

## 6. Backend (después del MVP)

| Fase | Contenido | Reutiliza |
|---|---|---|
| **B1 · Datos de MethaDesk** | API de lectura sobre `mc.*` con `mc_readonly`; sustituye al simulador de indicadores | `sql/`, réplica del VPS |
| **B2 · Acceso y permisos** | Login con Authentik, roles y proyectos desde `mc_auth`; protege todos los módulos | `sql/04_vistas_identidad.sql` |
| **B3 · Base propia** | Supabase de MethaCity: agentes, conversaciones, misiones, tareas, aprobaciones, actividad, documentos, programaciones (se amplía `01_schema.sql`) | `deploy/dev/methacity-db` |
| **B4 · Agentes reales** | `HermesGateway`: un perfil por unidad, el orquestador y los especialistas; chat en streaming; misiones dirigidas por el orquestador; herramientas de datos con el alcance del usuario; aprobaciones obligatorias en el servidor; auditoría | `deploy/dev/hermes` |
| **B5 · Archivos, memoria y canales** | Almacenamiento de documentos y archivos, memoria de Hermes, programaciones (cron de Hermes), puente con Telegram | — |
| **B6 · Sistema y producción** | Salud y terminal en el servidor, servicios de voz, despliegue en el servidor de METHABAU, backups (`ops/backup`), revisión de seguridad y de protección de datos (nDSG) | `sql/README.md` |

---

## 7. Calidad (todas las fases)
- Lógica con pruebas antes del código y cobertura ≥ 80 %; cada módulo con su prueba e2e en escritorio y móvil.
- La ciudad mantiene su presupuesto (≤ 200 llamadas de dibujo) aunque se añadan balizas, pabellones y etiquetas.
- Accesibilidad: todo lo que se hace en la escena se puede hacer desde paneles o listas con teclado.
- Revisión de código independiente al cierre de cada fase.

## 8. Qué se reaprovecha
| Elemento | Uso |
|---|---|
| Ciudad 3D (F2) | Pantalla de inicio y lienzo donde se ve trabajar a los agentes |
| Modelo y contrato (F1) | Unidades, jerarquía e indicadores de MethaDesk de cada agente |
| `sql/`, `deploy/dev/` | Backend B1–B4 |
| `PLAN-MethaCity.md` | Sigue vigente para arquitectura, seguridad, Hermes y branding |

## 9. Siguiente paso
Desplegar la demo en el VPS siguiendo `deploy/demo/README.md` (lo ejecutas tú): desde GitHub (`main`) o con el zip `dist/methacity-demo-eb34437.zip` (SHA-256 `a144edef…f05b33`). Tras la sesión de comentarios: priorizar F6 (operación) o el backend B1–B4 según lo que pidan los responsables.
