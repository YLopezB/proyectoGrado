# Dockerfile genérico para todos los microservicios Express.
# Contexto de build: ./services      Argumento: SERVICE=<carpeta del servicio>
# Targets: dev (nodemon, hot-reload)  |  prod (imagen mínima, usuario no-root)
ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS base
ENV NODE_PATH=/app/service/node_modules:/app
WORKDIR /app/service

# ---------- desarrollo ----------
FROM base AS dev
ARG SERVICE
ENV NODE_ENV=development
COPY ${SERVICE}/package*.json ./
RUN npm install
COPY shared /app/shared
COPY ${SERVICE}/src ./src
RUN mkdir -p /data
CMD ["npx", "nodemon", "-L", "--watch", "src", "--watch", "/app/shared", "src/index.js"]

# ---------- producción ----------
FROM base AS prod
ARG SERVICE
ENV NODE_ENV=production
COPY ${SERVICE}/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY shared /app/shared
COPY ${SERVICE}/src ./src
RUN mkdir -p /data && chown -R node:node /data /app
USER node
CMD ["node", "src/index.js"]
