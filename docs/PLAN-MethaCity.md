# MethaCity — Mission Control de agentes para MethaDesk

> Borrador v1 (2026-10-21). Nombre de trabajo "MethaCity", a confirmar.
> Basado en el clon local de `consstyle/MethaDesk` (APP_MAP.md, KI_Kontext.md, docs/system, CLAUDE.md, src/types, nombres de variables de .env.example) y en la documentación oficial de Hermes Agent.
> **Pendiente de verificar:** nombres de tablas y columnas contra el esquema real de producción; el clon local puede ir por detrás de `main`.
>
> **Rumbo actual (2026-10-21):** MethaCity es un sistema operativo de agentes inspirado en NEXORA. Las fases, los módulos y su prioridad están en [PLAN-DESARROLLO.md](PLAN-DESARROLLO.md) (v3). Este documento sigue vigente para arquitectura, seguridad, Hermes, acceso a MethaDesk y branding.

## 1. Objetivo
Ciudad 3D donde cada departamento de Methabau es un edificio. Cada edificio tiene un agente (Hermes Agent) que lee los datos de MethaDesk en **solo lectura**, resume, vigila plazos y propone acciones. Una persona aprueba todo lo que sale hacia fuera.

## 2. Decisiones tomadas
| Tema | Decisión |
|---|---|
| Motor de agentes | **Hermes Agent en Docker** (imagen `nousresearch/hermes-agent`) |
| Servidor | El mismo de MethaDesk (Dokploy, red interna de METHABAU; la IP no se publica) |
| Base de datos propia | Supabase propio, stack separado |
| Acceso a MethaDesk | Solo lectura, rol Postgres dedicado y vistas `mc_*` |
| Login | Authentik (OIDC), cliente nuevo |

## 3. Arquitectura
```
Navegador ──OIDC──► Authentik
    │
MethaCity web (Next.js)  ──►  Supabase propio (misiones, aprobaciones, logs, estado)
    │
MethaCity backend (API de datos / servidor de herramientas)
    ├── Postgres de MethaDesk: rol mc_readonly, solo vistas mc_*  (red interna)
    └── Hermes Agent (Docker): un perfil por departamento
            ├── API compatible con OpenAI (puerto 8642, API_SERVER_KEY)
            └── Telegram (opcional)
Salidas: SMTP / Telegram / borradores → siempre vía bandeja de aprobaciones
```

### 3.1 Cómo usar Hermes (según su documentación oficial)
- Un **perfil** = un agente: su propio `config.yaml`, `.env`, `SOUL.md`, memoria, sesiones, skills, cron y estado.
- Docker: el volumen `/opt/data` guarda todo el estado; la imagen no tiene estado. Nunca dos contenedores sobre el mismo directorio de datos.
- La documentación oficial indica **un contenedor con todos los perfiles** (cada uno con su gateway supervisado) y solo contenedores separados para límites de recursos, fijar versiones, segmentar red o aislar riesgo. (Un resumen de búsqueda de terceros decía lo contrario; **verificar contra la página oficial al montarlo**.)
- Crear perfil: `docker exec hermes hermes profile create <nombre>`; gestionarlo: `hermes -p <nombre> gateway start|stop|restart`.
- Cada perfil adicional con API propia necesita un `API_SERVER_PORT` distinto en su propio `.env`.
- API: `API_SERVER_ENABLED=true`; si se expone fuera del loopback, `API_SERVER_HOST=0.0.0.0` y `API_SERVER_KEY` (mínimo 8 caracteres).
- Panel web (puerto 9119, `HERMES_DASHBOARD=1`): soporta autenticación básica, OAuth de Nous o **OIDC propio** (se puede usar Authentik).
- Recursos: mínimo 1 GB y 1 CPU; recomendado 2–4 GB y 2 CPU. La automatización de navegador (Chromium) necesita al menos 2 GB: **desactivarla**.
- Los gateways se ejecutan sin root por defecto.

### 3.2 Seguridad específica de Hermes
- **Un perfil no es un sandbox:** no restringe el sistema de archivos y comparte el `HOME` real. Por eso:
  1. Los agentes **no reciben credenciales de la base de datos**. Solo llaman a herramientas del backend de MethaCity, que sí las tiene.
  2. Quitar o limitar el conjunto de herramientas de terminal de cada perfil.
  3. Fijar `terminal.cwd` y, si hace falta, `terminal.home_mode: profile`.
- Cada perfil con Telegram usa **su propio token de bot** (los bloqueos de token impiden compartirlo).
- Memoria **no compartida** entre perfiles. La memoria común de la empresa va por un proveedor externo o por la base de datos de MethaCity.
- Las claves de modelo (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) en `.env` de cada perfil, con permisos restrictivos (UID/GID del contenedor igual al del bind mount).

## 4. Acceso de solo lectura a MethaDesk
1. **Implementado en [`sql/`](sql/README.md):** tres roles de solo lectura, cada uno con su esquema de vistas (nunca tablas base):
   - `mc_readonly` → esquema `mc` (datos operativos para los agentes).
   - `mc_auth_readonly` → esquema `mc_auth` (identidad y permisos, solo para el login de MethaCity).
   - `mc_finanz_readonly` → esquema `mc_finanz` (importes; **opcional**, no se crea por defecto).
2. `default_transaction_read_only = on` y `statement_timeout` para ese rol.
3. Conexión directa a Postgres por la red interna de Docker. **No usar `service_role`** (escribe y se salta todo).
4. Excluir siempre: `users.notfall_hash`, tablas de sesión y `auth_audit_log`, adjuntos base64 del feedback, credenciales.
5. MethaDesk **no usa RLS**: sus permisos viven en la aplicación (permisos por departamento y `user_projekt_zuweisungen`). MethaCity debe **reimplementar** esas reglas: cada usuario ve solo sus proyectos y departamentos.
6. Las vistas `mc_*` y el rol se crean en la base de producción: requiere a alguien con acceso y debe anotarse (reglas de `CLAUDE.md`).

## 5. Ciudad: edificios

> **Sustituido (2026-10-21).** La ciudad sigue ahora la jerarquía de `preview/preview.html` (distrito industrial con Produktion / AVOR como núcleo y distrito de proyectos Projektleitung → Bauleitung → Bau). Ver [PLAN-DESARROLLO.md](PLAN-DESARROLLO.md) §2. La tabla siguiente queda como referencia histórica.
Departamentos reales de MethaDesk (`ABTEILUNGEN_CONFIG`): Projektleiter, Bauleitung, Planer, Einkauf, AVOR, Schlosserei, Blechabteilung, Werkhof, Montage, Bau, Subunternehmer, Unternehmer.

| Edificio | Señales de MethaDesk (hipótesis) | Perfil Hermes |
|---|---|---|
| Projektleiter | proyectos, hitos, riesgos | `projektleiter` |
| Bauleitung | Abrufe, Terminprogramm, montajes | `bauleitung` |
| Planer | TS en planificación, "Abgabe Planer" vencida | `planer` |
| Einkauf | pedidos, plazos de compra | `einkauf` |
| AVOR | TS abiertos, grupos | `avor` |
| Schlosserei / Blech | TS en fabricación, cola, retrabajos | `produktion` |
| Werkhof | pedidos por entregar, Lager | `werkhof` |
| Montage | duración de producción, TS listos | `montage` |
| Bau | pedidos y tareas de obra | `bau` |
| Subunternehmer / Unternehmer | proveedores y contratistas | `externos` |
| Lager (extra) | stock, paquetes, ubicaciones | `logistica` |
| Fuhrpark (extra) | vehículos y máquinas | `flota` |
| Obras (extra) | un solar por proyecto activo | (sin agente propio) |
| Torre IT (extra) | salud del sistema, backups, feedback | `admin` |
| Plaza central | orquestador | `chief` |

Indicadores sobre cada edificio: TS en curso, retrasos, retrabajos, pedidos vencidos, aprobaciones pendientes, agente trabajando o libre.

## 6. Índice de funcionalidades

### A. City y panel
- A1. Mapa 3D, con vista 2D rápida para móvil.
- A2. Estado en vivo por edificio.
- A3. Capa de alertas: TS retrasado, pedido vencido, retrabajo, plazo de Abruf.
- A4. Clic en un edificio → panel del departamento y chat con su agente.
- A5. Vista Obras: un edificio por proyecto, con avance.
- A6. Cockpit: resumen del día, tokens y coste de IA.

### B. Orquestador y agentes
- B1. Orquestador `chief`: reparte, planifica y pide aprobación.
- B2. Un agente por departamento, con identidad (`SOUL.md`) y reglas propias.
- B3. Memoria por agente y memoria compartida (normas, clientes, proveedores) fuera de Hermes.
- B4. Modelo según dificultad, con respaldo.

### C. Inteligencia sobre datos de MethaDesk (solo lectura)
- C1. Resumen diario por departamento y por proyecto.
- C2. Detección de cuellos de botella: TS parados, fechas imposibles, desviaciones de la Terminkette.
- C3. Preguntas en lenguaje natural sobre proyectos y TS.
- C4. Vigilancia de plazos: Abruf, pedidos y entregas del Werkhof.
- C5. Informes automáticos para dirección (semanal y mensual).
- C6. Análisis de retrabajos y causas.
- C7. Control de costes, horas y materiales.
- C8. Estado de Lager y Fuhrpark.
- C9. Auditoría: cambios sospechosos en el changelog.

### D. Aprobaciones y acciones
- D1. Bandeja de aprobaciones: todo lo que sale pasa por una persona.
- D2. Borradores de correo (SMTP) y avisos por Telegram.
- D3. Misiones multi-departamento con plan por pasos.
- D4. Plantillas de misión: arranque de obra, cierre de mes, revisión semanal.
- D5. Escritura en MethaDesk por API limitada (fase posterior).

### E. Automatización
- E1. Tareas programadas (informes, recordatorios, vigilancia), con el cron de Hermes o el de MethaCity.
- E2. Reglas en lenguaje natural.
- E3. Disparadores por eventos de MethaDesk (consulta periódica, o `LISTEN/NOTIFY` si se habilita).

### F. Comunicación
- F1. Chat por agente.
- F2. Voz.
- F3. Telegram con un canal por departamento.
- F4. Polish: mejora tus prompts.

### G. Documentos y conocimiento
- G1. Informes en Docs.
- G2. Búsqueda semántica sobre documentos.
- G3. Manuales y "Schule" de MethaDesk como base de conocimiento.
- G4. Copias de seguridad de las versiones.

### H. Seguridad
- H1. Login por Authentik.
- H2. Roles de MethaDesk (`user`, `superuser`, `admin`, `superadmin`) y permisos por proyecto y departamento.
- H3. Separación de datos sensibles: horas y empleados solo para quien corresponda.
- H4. Auditoría completa de lo que hace cada agente.
- H5. Límites de gasto y acciones por agente.
- H6. Control del envío de datos a modelos externos (nDSG suizo).

### I. Sistema
- I1. Estado del servidor y de la conexión a MethaDesk.
- I2. Terminal restringida solo a superadmin.
- I3. Actualización con un clic y vuelta atrás.
- I4. Viñetas "Neu!" y tour guiado, según las convenciones de MethaDesk.
- I5. `/api/health` propio.

## 7. Despliegue en Dokploy
- Servicios nuevos: `methacity-web`, `methacity-backend`, `hermes` (volumen con nombre, no bind mount en Windows/macOS), stack Supabase propio.
- Variables de entorno en Dokploy → Environment; las `NEXT_PUBLIC_*` como Build Args.
- **Backup:** cada servicio y volumen nuevo debe entrar en `ops/backup` (`FILE_DIRS`, volúmenes) y pasar `methadesk-backup.sh audit` sin `[FALTA]`. Esto incluye el volumen de datos de Hermes (contiene credenciales: permisos estrictos).
- Capacidad: revisar RAM y CPU libres del servidor (`F0-DIAGNOSTICO*.md`). Hermes (2–4 GB), Supabase y el visor 3D suman carga.

## 8. Fases

> **Sustituido (2026-10-21)** por [PLAN-DESARROLLO.md](PLAN-DESARROLLO.md): primero el frontend (F0–F6) y después el backend (B1–B6).
1. **Fase 0 — cimientos** (primero en el VPS de desarrollo: ver [`deploy/dev/README.md`](deploy/dev/README.md)): rol `mc_readonly`, vistas `mc_*`, stack Supabase, cliente OIDC en Authentik, contenedor Hermes con el perfil `chief`.
2. **Fase 1 — MVP:** ciudad con 3 edificios (Planer, Einkauf, Werkhof), 3 perfiles + `chief`, resúmenes diarios y bandeja de aprobaciones.
3. **Fase 2:** resto de departamentos, Obras y alertas.
4. **Fase 3:** misiones multi-departamento, voz y Telegram.
5. **Fase 4:** escritura controlada en MethaDesk por API.

## 9. Branding (heredado de MethaDesk)
Fuentes: pantalla de login de MethaDesk (captura), `src/app/globals.css` del repo y la skill `methabau-branding`. MethaCity usa **el mismo branding que MethaDesk**.

- **Color de marca:** naranja `#ff6b35` (hover `#e5602f`; escala `orange-50 … 950`, p. ej. 100 `#ffe3da`, 700 `#cc562a`).
- **Modo claro:** fondo y tarjetas `#ffffff`, elementos atenuados `#f8fafc`, bordes `#e2e8f0`; texto `#334155` / `#475569`, secundario `#64748b` / `#94a3b8`.
- **Modo oscuro:** fondo `#020617`, tarjetas `#0f172a`, bordes y secundarios `#1e293b`, texto `#fafafa`; el naranja es el acento. Nunca negro puro.
- **Estado de error:** `#ef4444` (solo errores y alertas críticas).
- **Tipografía:** Inter (con `system-ui, -apple-system, sans-serif`); títulos en negrita o extranegrita con tracking ajustado.
- **Forma:** radios entre 0.75 y 1.5 rem; sombras suaves (`rgba(0,0,0,0.05)`); botón primario con sombra naranja (`rgba(255,107,53,0.15)`); bordes naranja tenues en reposo, más intensos al pasar el cursor o al enfocar.
- **Logotipo:** "METHA" en negrita gris pizarra + "Desk" en naranja + "pro" pequeño y atenuado. Propuesta: **"METHA" + "City" (naranja) + "pro"** (nombre a confirmar).
- **Mascota:** MethaBot, el robot con casco naranja (`public/methabot-icon.svg`, `methabot-256.png` y `methabot.ico` en el repo de MethaDesk). Será el avatar del orquestador `chief`.
- **Pantalla de login (se reutiliza el diseño):** tarjeta blanca translúcida y centrada sobre el boceto de obra en gris (`public/construction_sketch_bg.jpg`), botón naranja de acceso con METHABAU-Konto (Authentik), enlace "Notfall-Zugang für Administratoren", enlace "Zugang anfragen", logos METHABAU y "Powered by" abajo a la izquierda, versión abajo a la derecha.
- **Ciudad 3D:** edificios en blanco y pizarra, con el naranja para marcar actividad; los colores de `ABTEILUNGEN_CONFIG` solo como acento secundario por departamento; rojo solo para alertas críticas; modo oscuro sobre `slate-950`.
- **Idioma de la interfaz:** solo alemán, como MethaDesk (decidido el 2026-10-21), con ortografía suiza. La documentación sigue en español.
- **Pendiente:** confirmar que los logos de METHABAU y "Powered by" pueden reutilizarse (la carpeta `docs/Logo_Methabau` del clon está vacía) y copiar entonces los recursos al proyecto.

## 10. Puntos abiertos
1. Privacidad: qué datos pueden ir a un modelo en la nube (empleados, horas, feedback) y cuáles se anonimizan.
2. Modelo/proveedor de LLM para los agentes.
3. Nombre definitivo del producto.
4. Un contenedor con todos los perfiles, o separar los más sensibles (decidir tras revisar los datos que ve cada uno).
5. Quién crea el rol y las vistas en la base de producción.
6. Capacidad real del servidor.
