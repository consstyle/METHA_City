# MethaCity · entorno de desarrollo en el VPS de Hostinger (Dokploy)

Runbook para montar el primer entorno de MethaCity en tu VPS. **Lo ejecutas tú por SSH**; yo no tengo acceso al VPS.

> **No uses datos reales de Methabau aquí.** La réplica de MethaDesk se llena con datos sintéticos (`replica/20_seed.sql`: personas «Demo …», proyectos DEV-00x). Este VPS no debe conectarse nunca a la base de producción de MethaDesk (`methadesk-prod`).

## Qué se monta

```
VPS Hostinger (Dokploy)
├─ methacity-dev-db        Postgres 16: réplica del esquema de MethaDesk + datos sintéticos
│                          + roles y vistas de solo lectura (carpeta ../../sql)
├─ methacity-dev-hermes    Hermes Agent: perfil por defecto + perfil `chief` (orquestador)
└─ methacity-supabase      Supabase PROPIA de MethaCity (plantilla de Dokploy) + methacity-db/01_schema.sql
```

Nada se publica: ni puertos ni dominios. Se entra por `docker exec` o por túnel SSH.

**Fuera de alcance de esta fase** (aún no existe): el backend de MethaCity, la interfaz 3D y la conexión de Hermes a los datos. El perfil `chief` podrá conversar y planificar, pero todavía no consulta datos.

## Estado de la validación

| Parte | Probado |
|---|---|
| `replica/10_schema.sql`, `20_seed.sql`, `sql/*` (roles, vistas, permisos, verificación) | **Sí**, en un Postgres simulado (PGlite): 12 departamentos con datos, aislamiento de los tres roles, re-ejecución del seed |
| `methacity-db/01_schema.sql` | **Sí**, en PGlite, con y sin roles de Supabase, re-ejecutable |
| Scripts `.sh` | Solo sintaxis (`bash -n`) |
| `docker-compose.yml`, Dokploy, plantilla de Supabase, contenedor y comandos de Hermes | **No**: aquí no hay Docker. Si algo falla, pega la salida en el chat |

## Requisitos

- Dokploy funcionando en el VPS y acceso SSH con tu usuario.
- RAM libre recomendada: **≥ 4 GB** (Hermes 2–4 GB, Postgres 1 GB, Supabase ~2 GB). El paso 1 lo comprueba.

## Paso 1 · Diagnóstico (solo lectura)

Desde tu PC (PowerShell), sustituye `usuario@IP`:

> `replica/10_schema.sql` (réplica del esquema de producción de MethaDesk) **no está en GitHub**, porque el repositorio es público. Tu copia local la conserva; si falta, regenérala desde el repositorio de MethaDesk:
> `node deploy/dev/tools/build-replica-schema.mjs "<ruta al repo MethaDesk>"`

```powershell
ssh usuario@IP "mkdir -p ~/methacity"
scp -r "C:\Users\f.martinez\methacity\deploy" "C:\Users\f.martinez\methacity\sql" usuario@IP:~/methacity/
ssh usuario@IP "bash ~/methacity/deploy/dev/scripts/diagnose-vps.sh"
```

Pégame la salida. No imprime secretos. Con ella confirmo RAM, disco, puertos y qué hay ya instalado.

## Paso 2 · Variables

En el VPS:

```bash
cd ~/methacity/deploy/dev
chmod +x scripts/*.sh
cp .env.example .env && chmod 600 .env
for v in POSTGRES_SUPERUSER_PASSWORD MD_OWNER_PW MC_READONLY_PW MC_AUTH_PW HERMES_API_KEY HERMES_CHIEF_API_KEY; do
  sed -i "s|^$v=.*|$v=$(openssl rand -hex 24)|" .env
done
grep -c '=$' .env   # debe mostrar 1: solo MC_FINANZ_PW queda vacía
```

Guarda el `.env` en tu gestor de contraseñas. No lo subas a ningún repositorio.

## Paso 3 · Hermes: asistente de configuración (una vez)

Hermes guarda su estado en el volumen `methacity-hermes-data`. Se crea y se configura **antes** de desplegar el compose:

```bash
docker volume create methacity-hermes-data
docker run -it --rm -v methacity-hermes-data:/opt/data nousresearch/hermes-agent:stable setup
```

El asistente te pide el proveedor de modelos y la clave de API. **Escríbelas tú en el asistente; no me las pases a mí.** Para desarrollo usa una clave con límite de gasto.

## Paso 4 · Desplegar el compose en Dokploy

1. Dokploy → *Projects* → crea el proyecto `methacity-dev`.
2. *Create Service* → **Compose** → tipo *Docker Compose* → pega el contenido de `docker-compose.yml`.
3. Pestaña *Environment*: pega las variables del `.env` (al menos `POSTGRES_SUPERUSER_PASSWORD` y `HERMES_API_KEY`).
4. **No añadas dominios ni puertos.** → *Deploy*.
5. Comprueba: `docker ps --format '{{.Names}}\t{{.Status}}' | grep methacity`

Si Dokploy rechaza `external: true` en el volumen o los `container_name`, dímelo y lo adapto.

## Paso 5 · Réplica de MethaDesk y SQL de MethaCity

```bash
cd ~/methacity/deploy/dev
./scripts/bootstrap-replica.sh
```

Hace, en orden: roles y base `methadesk` → esquema → datos sintéticos → preflight → roles, vistas y permisos → contraseñas → verificación. Debe terminar con **«RESULTADO: todo correcto»** y una tabla de indicadores de los 12 departamentos.

- Repetir desde cero: `./scripts/bootstrap-replica.sh --reset`
- Solo volver a verificar: `./scripts/verify.sh`
- Incluir las vistas económicas: `ENABLE_FINANZ=1` y `MC_FINANZ_PW` en el `.env`

## Paso 6 · Supabase propia de MethaCity

1. Dokploy → *Templates* → **Supabase** → nómbrala `methacity-supabase` → *Deploy*. No expongas Studio ni la API públicamente: accede por túnel SSH.
2. Localiza su contenedor de base de datos y aplica el esquema:

```bash
DBC=$(docker ps --format '{{.Names}}' | grep -i 'supabase' | grep -i 'db' | head -1); echo "$DBC"
docker exec -i "$DBC" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < ~/methacity/deploy/dev/methacity-db/01_schema.sql
docker exec "$DBC" psql -U postgres -d postgres -c "SELECT id, name FROM public.mc_agent ORDER BY 1"
```

Deben salir los 14 agentes. El esquema deja las tablas con RLS activado y sin políticas: solo accede el backend con la clave `service_role`.

## Paso 7 · Perfil `chief` de Hermes

```bash
cd ~/methacity/deploy/dev
./scripts/hermes-chief.sh
docker exec -it methacity-dev-hermes hermes -p chief chat      # conversación de prueba
docker run --rm --network methacity-dev-net curlimages/curl -s http://methacity-dev-hermes:8643/health
```

## Lista de comprobación

| # | Comprobación | Esperado |
|---|---|---|
| 1 | `docker ps` | `methacity-dev-db` (healthy), `methacity-dev-hermes` y los contenedores de Supabase en marcha |
| 2 | `./scripts/verify.sh` | todas las líneas `OK`, ningún `FALLO` |
| 3 | indicadores | 12 filas, todas con `ts_gesamt` > 0 |
| 4 | Supabase propia | 14 agentes en `mc_agent` |
| 5 | Hermes `chief` | responde al chat y a `/health` en 8643 |
| 6 | `ss -tlnp` en el VPS | ninguno de estos contenedores publica puertos nuevos |

## Seguridad de este entorno

- Cortafuegos del VPS: solo SSH y los puertos 80/443 de Dokploy. Comprueba `ufw status` (el diagnóstico lo muestra).
- Clave SSH en lugar de contraseña, y sin acceso root directo si es posible.
- Hermes no recibe credenciales de ninguna base de datos. Cuando exista el backend, será el único que use `mc_readonly`.
- El `.env` y el volumen de Hermes contienen secretos: permisos estrictos y nunca en un repositorio.
- Datos solo sintéticos. Para pasar a producción se usan los mismos scripts de `../../sql` sobre el Postgres de MethaDesk, como indica `../../sql/README.md`.

## Limpieza

```bash
# réplica de MethaDesk
./scripts/bootstrap-replica.sh --reset
# todo el compose: en Dokploy, borrar el servicio; después, si quieres borrar los datos:
docker volume rm methacity-dev-db-data methacity-hermes-data
```

## Siguientes pasos (no incluidos aquí)

1. Backend de MethaCity: herramientas de datos para los agentes sobre `mc_readonly`, con los permisos por proyecto y departamento leídos de `mc_auth`.
2. Interfaz con el branding de MethaDesk y la ciudad 3D.
3. Perfiles de Hermes por departamento.
