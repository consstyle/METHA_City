# MethaCity · imagen de la demo del MVP (F5b). Salida standalone de Next.js, usuario sin privilegios.
# Se construye en el VPS (Dokploy, build por Dockerfile). Datos: solo el simulador (D24).

ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    # Falla cerrada (D22): sin DEMO_USER y DEMO_PASSWORD válidos la app responde 503.
    METHACITY_REQUIRE_AUTH=1
# El código queda de root (solo lectura para la app): un fallo en la app no puede reescribirlo.
# Solo la caché de Next es escribible por el usuario `node`.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
