# Misión Cóndor · Cómo publicarlo (deploy)

## Lo que hay que entender primero

El juego son **dos cosas en un solo proceso** (`herramientas/servir.mjs`, copiado a `dist/servir.mjs`):

1. archivos estáticos del juego (lo que genera `vite build`);
2. el **servidor multijugador**: WebSocket en `/ws`, salas en memoria y SQLite (`condor.db`) en la carpeta `CONDOR_DATOS`.

Reglas que salen de ahí:

| Regla | Por qué |
|---|---|
| Necesita **Node 22.5 o más** (la imagen usa Node 24) | usa `node:sqlite`, que viene dentro de Node |
| Necesita un hosting que corra un **proceso** (no solo archivos) | el WebSocket y la base viven en el proceso |
| **Una sola instancia** (no escalar a 2+) | las salas están en memoria; dos jugadores en procesos distintos no se encuentran |
| **Disco persistente** montado en `CONDOR_DATOS` | si no, el ranking se borra en cada redeploy |
| HTTPS en producción | el cliente usa `wss://` cuando la página es `https://` (automático) |

Variables:

| Variable | Dónde | Para qué | Por defecto |
|---|---|---|---|
| `PORT` | servidor | puerto HTTP | 8080 (8787 en desarrollo) |
| `CONDOR_DATOS` | servidor | carpeta de la base SQLite | `datos/` junto a `servir.mjs` |
| `VITE_SERVIDOR_MP` | al **compilar** el juego | URL `wss://…/ws` si el juego y el servidor están en sitios distintos | vacío = mismo sitio |

Comandos:

```bash
npm run build:servidor   # dist/ con el juego + servir.mjs (lo que se sube)
npm start                # node dist/servir.mjs
```

```bash
curl http://localhost:8080/api/salud    # → {"ok":true,"salas":0}
```

---

## Elegir camino

| Camino | Costo | Multijugador | Ranking persistente | Para |
|---|---|---|---|---|
| **A. Render** (recomendado) | starter ~7 USD/mes + 1 GB disco (gratis: sin disco y se duerme) | sí | sí con plan pago | el hackathon y después |
| **B. Fly.io** | bajo costo con volumen de 1 GB | sí | sí | quien ya usa Fly |
| **C. VPS / PC propia con Docker** | lo que cueste la máquina | sí | sí | control total, LAN del evento |
| **D. GitHub Pages + A/B/C** | Pages gratis | sí (servidor aparte) | según el servidor | URL `github.io` para el juego |
| GitHub Pages solo | gratis | **no** | no | solo modo historia |

> Sin GitHub también se puede: B y C funcionan subiendo la carpeta o con `fly deploy` desde la PC.
> GitHub solo hace falta para el deploy automático en cada push.

---

## A. Render (con GitHub)

1. Sube el proyecto a un repo de GitHub (ver «Subir a GitHub» abajo).
2. En render.com: **New → Blueprint**, elige el repo. Lee `render.yaml` y crea el servicio Docker con disco en `/datos`.
3. Espera el primer build (~3 min). Render da `https://mision-condor.onrender.com`.
4. Prueba `https://…onrender.com/api/salud` y juega con dos navegadores.

Notas:

- **Plan free:** borra el bloque `disk:` de `render.yaml` y cambia `plan: free`. El servicio se duerme a los 15 min sin visitas; la primera carga tarda unos 50 s y el ranking se reinicia en cada deploy.
- **Antes de presentar:** abre la URL 2 minutos antes para despertarlo.
- `autoDeploy: true` publica solo en cada push a `main`.

## B. Fly.io (con o sin GitHub)

```bash
fly launch --no-deploy          # usa fly.toml; cambia el nombre de la app si está ocupado
```

```bash
fly volumes create condor_datos --size 1 --region scl
```

```bash
fly deploy
```

```bash
fly scale count 1               # SIEMPRE 1 máquina
```

El día de la presentación pon `min_machines_running = 1` en `fly.toml` y corre `fly deploy` para que no se duerma.

## C. VPS / PC propia (con o sin GitHub)

En la máquina, con Docker instalado:

```bash
docker compose up -d --build
```

Queda en `http://IP:8080`.

Con dominio y HTTPS automático (el dominio debe apuntar a la IP; abre los puertos 80 y 443):

```bash
DOMINIO=condor.midominio.com docker compose --profile https up -d --build
```

Sin Docker basta con Node 24 y `dist/` (el mismo `MisionCondor.zip`):

```bash
PORT=8080 CONDOR_DATOS=/var/lib/condor node servir.mjs
```

Para dejarlo como servicio usa `pm2` o `systemd`. Detrás de Nginx hay que reenviar el WebSocket:

```nginx
location / {
  proxy_pass http://127.0.0.1:8080;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;
}
```

**En el evento sin internet:** la PC del stand corre `dist/iniciar.bat`; los demás entran por `http://IP-DE-LA-PC:8080` en la misma Wi-Fi.

## D. Juego en GitHub Pages + servidor aparte

1. Levanta el servidor con A, B o C. Anota su URL, por ejemplo `https://mision-condor.onrender.com`.
2. En GitHub: Settings → Secrets and variables → Actions → **Variables** → `VITE_SERVIDOR_MP` = `wss://mision-condor.onrender.com/ws`.
3. Settings → Pages → Source: **GitHub Actions**.
4. Actions → **GitHub Pages** → Run workflow.

El juego queda en `https://USUARIO.github.io/REPO/` y el multijugador se conecta al servidor de Render o Fly.

---

## Subir a GitHub

El proyecto aún no es un repositorio git. `.gitignore` ya excluye `node_modules`, `dist`, el zip y las bases de datos.

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "Misión Cóndor: juego + multijugador + deploy"
```

```bash
git remote add origin https://github.com/USUARIO/mision-condor.git
```

```bash
git push -u origin main
```

Con el push corre `.github/workflows/imagen.yml`. Compila, comprueba que el servidor responde y publica la imagen en `ghcr.io/usuario/mision-condor:latest`. Si existe el secreto `RENDER_DEPLOY_HOOK`, también avisa a Render.

## Lista de control antes de presentar

- [ ] `/api/salud` responde `ok: true`
- [ ] La página carga por `https://` y el lobby conecta (sin «sin conexión»)
- [ ] Partida completa con 2 dispositivos distintos (uno en datos móviles, no solo en la misma Wi-Fi)
- [ ] El ranking sigue ahí después de un redeploy (prueba de disco persistente)
- [ ] Una sola instancia
- [ ] Servicio despierto 2 minutos antes de la presentación
- [ ] Plan B: `MisionCondor.zip` en un pendrive + `iniciar.bat` en la red local
