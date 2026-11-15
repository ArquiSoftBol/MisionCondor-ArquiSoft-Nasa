# Misión Cóndor · imagen única: juego + multijugador (WebSocket /ws) + SQLite
# Construir:  docker build -t mision-condor .
# Correr:     docker run -p 8080:8080 -v condor-datos:/datos mision-condor   → http://localhost:8080

# ── 1) compilar el juego ──
FROM node:24-alpine AS compilar
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_SERVIDOR_MP vacío = el juego habla con el mismo servidor que lo sirve (lo normal en Docker)
ARG VITE_SERVIDOR_MP=
ENV VITE_SERVIDOR_MP=$VITE_SERVIDOR_MP
RUN npm run build:servidor

# ── 2) imagen final: solo Node + dist (sin node_modules: el servidor no tiene dependencias) ──
FROM node:24-alpine
WORKDIR /app
COPY --from=compilar /app/dist ./
ENV NODE_ENV=production \
    PORT=8080 \
    CONDOR_DATOS=/datos
RUN mkdir -p /datos && chown node:node /datos
USER node
VOLUME ["/datos"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/salud || exit 1
CMD ["node", "servir.mjs"]
