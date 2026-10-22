# MethaCity · demo del MVP en el VPS (F5b)

Runbook para publicar la demo del MVP (Stadt, Leitstand, Agenten, Chat, Missionen, Freigaben, Aufgaben, Aktivität) en tu VPS de Hostinger con Dokploy, para la sesión de comentarios. **Lo ejecutas tú**; yo no tengo acceso al VPS ni he subido nada a ningún sitio.

- **Datos:** solo el simulador (sin conexión a MethaDesk ni a Hermes). Cada navegador guarda sus propias misiones, chats y contrataciones (localStorage): **no se comparten entre usuarios**.
- **Acceso:** usuario y contraseña temporales (Basic Auth de la propia app) sobre HTTPS. Sin credenciales válidas la app responde 503 (**no puede quedar abierta por un olvido**) y, detrás de Traefik, rechaza las peticiones por HTTP (403) para que la contraseña nunca viaje en claro.
- **Buscadores:** `robots.txt` cerrado y cabecera `X-Robots-Tag: noindex`.

## Estado de la validación

| Qué | Probado aquí |
|---|---|
| Compilación standalone, `node server.js`, `/api/health`; con `X-Forwarded-Proto: https` (como Traefik): 200 con credenciales buenas; por HTTP: 403; sin credenciales configuradas: 503; rutas parecidas (`/api/healthz`, `/api/health/../leitstand`, `/robots.txt.bak`) protegidas | **Sí** (Windows, Node 22); reglas de acceso con pruebas unitarias |
| `docker build` del `Dockerfile`, Dokploy, Traefik, certificado | **No**: aquí no hay Docker. Si algo falla, pega la salida en el chat |

## Requisitos

- Dokploy funcionando, puertos 80/443 abiertos en el cortafuegos.
- Un subdominio (p. ej. `methacity-demo.tudominio.ch`) con registro **DNS A** hacia la IP del VPS, **sin proxy de CDN** (en Cloudflare: «DNS only», nube gris). Un proxy compartido podría guardar en caché archivos pedidos con credenciales.
- Unos **2 GB de RAM libres durante la compilación** (Next.js). Si el VPS va justo, activa swap o compila fuera de horas.

## Paso 1 · Empaquetar el código (en tu PC)

El zip contiene **solo el commit actual** (`git archive`): nada de `node_modules`, builds, `.env` ni datos locales.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-demo.ps1
```

Muestra la ruta del zip (`dist/methacity-demo-<commit>.zip`), el commit y su SHA-256 (anótalo para comprobarlo en el VPS). Si hay cambios sin commit, se niega a empaquetar.

## Paso 2 · Credenciales temporales

Genera una contraseña larga (**mínimo 16 caracteres**, mejor solo ASCII) en el VPS o en tu PC:

```bash
openssl rand -base64 24
```

Guárdala en tu gestor de contraseñas. **No la pegues en el chat ni en el repositorio.** El usuario no puede contener «:».

## Paso 3 · Opción A (recomendada): aplicación de Dokploy con subida del zip

1. Dokploy → *Projects* → crea el proyecto **`methacity-demo`** → *Create Service* → **Application** → nombre `methacity-demo`.
2. Pestaña *General* → *Provider*: **Drop** → arrastra el zip del paso 1.
3. *Build Type*: **Dockerfile** (ruta `Dockerfile`, contexto la raíz).
4. Pestaña *Environment*:
   ```
   DEMO_USER=<usuario>
   DEMO_PASSWORD=<la contraseña del paso 2>
   ```
   (`METHACITY_REQUIRE_AUTH=1` ya viene en la imagen.)
5. Pestaña *Domains* → *Add Domain*: tu subdominio, **puerto 3000**, **HTTPS activado**, certificado **Let's Encrypt**.
6. *Advanced → Resources* (opcional): límite de memoria 768 MB.
7. **Deploy** y sigue los logs hasta ver `Ready`.

Si tu versión de Dokploy no tiene el proveedor «Drop», usa la opción B.

> **Endurecimiento:** la imagen ya corre sin privilegios y con el código en solo lectura para la app. La opción B añade además sistema de archivos de solo lectura, sin capacidades, límite de peticiones en Traefik y rotación de logs; en la opción A eso depende de lo que permita tu versión de Dokploy (*Advanced*). Para una demo corta con contraseña generada es suficiente; si la demo va a durar semanas, mejor la opción B.

## Paso 3 · Opción B: por SSH con docker compose

```bash
# en tu PC
scp dist/methacity-demo-<commit>.zip usuario@IP:~/methacity-demo.zip
# en el VPS
sha256sum ~/methacity-demo.zip            # debe coincidir con el SHA-256 del paso 1
mkdir -p ~/methacity-demo && cd ~/methacity-demo && unzip -o ~/methacity-demo.zip
install -m 600 deploy/demo/.env.example deploy/demo/.env   # nace con permisos 600
nano deploy/demo/.env                      # DEMO_HOST, DEMO_USER, DEMO_PASSWORD
docker compose -f deploy/demo/docker-compose.yml --env-file deploy/demo/.env up -d --build
docker logs -f methacity-demo
```

Usa la red `dokploy-network` y el resolver `letsencrypt` del Traefik de Dokploy. Si Traefik no recoge el contenedor, comprueba los nombres con `docker network ls` y `docker inspect dokploy-traefik`, y dímelo.

## Paso 4 · Comprobación

```bash
curl -s https://<subdominio>/api/health            # {"status":"ok"}
curl -sI https://<subdominio>/ | head -n 1          # HTTP/2 401  (pide usuario y contraseña)
curl -sI -u '<usuario>' https://<subdominio>/ | head -n 1   # pide la contraseña → HTTP/2 200
curl -s https://<subdominio>/robots.txt             # Disallow: /
curl -sI http://<subdominio>/ | head -n 1           # 301/308 hacia HTTPS (o 403 si llega por HTTP)
```

(`curl -u usuario` sin la contraseña la pide por teclado: así no queda en el historial de la shell.)

En el navegador (Chrome o Edge, por WebGL): aparece el diálogo de acceso → la ciudad 3D. Prueba el flujo completo: *Missionen* → nueva misión → *Freigaben* → aprobar plan → ver a los agentes trabajar en la ciudad → aprobar el resultado → informe.

## Lista de comprobación

- [ ] El zip corresponde al commit que quieres enseñar.
- [ ] Contraseña generada (≥ 16 caracteres), solo en Dokploy y en tu gestor.
- [ ] El subdominio va sin proxy de CDN.
- [ ] HTTPS con certificado válido; HTTP redirige a HTTPS.
- [ ] Sin credenciales: 401. Credenciales falsas: 401. Buenas: 200.
- [ ] `/api/health` responde (Dokploy y Docker lo usan como comprobación de salud).
- [ ] Nada de datos reales: el panel dice «SIMULIERTE DATEN».

## Compartir con los responsables

- Envía la URL y las credenciales **por canales separados** (p. ej. URL por correo, contraseña por teléfono o Teams).
- Avisa de que cada persona ve **su propia** simulación y de que los datos se quedan en su navegador.
- Navegador recomendado: Chrome o Edge actuales (la vista 3D necesita WebGL; sin él, la app sigue funcionando sin la ciudad).

## Después de la sesión

- **Cambiar la contraseña:** Dokploy → *Environment* → nueva `DEMO_PASSWORD` → *Redeploy*.
- **Parar la demo:** Dokploy → *Stop* (o `docker compose -f deploy/demo/docker-compose.yml down` en la opción B).
- **Actualizar:** nuevo zip (paso 1) → *Drop* → *Deploy*.
- **Retirarla del todo** (Dokploy guarda las variables en claro):
  - Opción A: borra la aplicación `methacity-demo` en Dokploy (con sus variables y su dominio).
  - Opción B: `docker compose -f deploy/demo/docker-compose.yml down`, `docker image rm methacity-demo:latest` y `rm -rf ~/methacity-demo ~/methacity-demo.zip` (incluye el `.env`).
  - Borra el registro DNS del subdominio.

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| 503 «Die Demo ist nicht konfiguriert» | Falta `DEMO_USER` o `DEMO_PASSWORD`, o la contraseña tiene menos de 16 caracteres o el usuario lleva «:» |
| 403 «Bitte über HTTPS aufrufen» | Se entra por HTTP: activa HTTPS en el dominio de Dokploy (paso 3.5). También pasa si se llama al contenedor directamente sin Traefik (es lo esperado) |
| La compilación se corta (`Killed`, código 137) | Falta memoria durante `next build`: añade swap o libera RAM |
| Error `EROFS` en los logs (opción B) | El contenedor es de solo lectura: quita `read_only: true` del compose y avísame |
| Certificado no válido | El DNS aún no apunta al VPS o el puerto 80 está cerrado (Let's Encrypt lo necesita) |
| Pide la contraseña en cada recurso | Normal la primera vez; el navegador la recuerda durante la sesión |
