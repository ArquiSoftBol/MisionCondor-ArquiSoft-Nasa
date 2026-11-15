# Misión Cóndor

Juego web de ARQUISOFT para el NASA Space Apps Challenge 2026. Un/a ingenier@ aeroespacial del Salar de Uyuni viaja
a Europa por un microorganismo que puede devolverle el aire a la Tierra… y promete volver con su mascota.

**Modo historia:** cinemáticas + 6 minijuegos (sistemas vitales, cohete, Orión, despegue, tormenta en Base Tari,
rover en Europa), con guía «Cómo se juega» en cada uno, pantalla de ruta entre partes y final con créditos.
**Multijugador:** 2 jugadores (Ingeniero y Recolector) en salas con código, servidor propio con SQLite.

## Comandos

```bash
npm install
```

```bash
npm run dev            # juego en http://localhost:5173 (con npm run servidor para el multijugador)
```

```bash
npm run servidor       # multijugador en desarrollo (puerto 8787)
```

```bash
npm run empaquetar     # dist/ + MisionCondor.zip (jugable sin internet con dist/iniciar.bat)
```

## Atajos de prueba

`?escena=MisionMarte` (o cualquier escena) · `?escena=Cinematica&bloque=epilogo&cuadro=3` · `?escena=Capitulo&paso=9`
· `?escena=Fin` · `?idioma=en` · `?prueba` (bucle con temporizador: sirve con la pestaña en segundo plano).

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Orden de la aventura | `src/core/flujo.ts` · misiones y estrellas en `src/core/misiones.ts` |
| Textos de la historia / guías / inglés | `src/data/historia.ts` · `src/data/guias.ts` · `src/data/en.ts` |
| Música por fase (Guía Maestra) | `src/core/musica.ts` · pistas en `public/audio/` |
| Botones, paneles, íconos | `src/ui/boton.ts` · `src/ui/iconos.ts` |
| Equipo y créditos | `src/data/archivo.ts` (completar lo que está entre [corchetes]) |
| Servidor (juego + multijugador) | `herramientas/servir.mjs` |

## Documentación

- Guion por escenas: [docs/GUION.md](docs/GUION.md) · Historia del multijugador: [docs/HISTORIA_MULTIJUGADOR.md](docs/HISTORIA_MULTIJUGADOR.md)
- Stack y proceso: [docs/STACK_TECNOLOGICO.md](docs/STACK_TECNOLOGICO.md) · Arquitectura: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- Sprites e íconos: [docs/SPRITES.md](docs/SPRITES.md) · Publicar (deploy): [docs/DEPLOY.md](docs/DEPLOY.md)
- Planes ya ejecutados: [docs/historial/](docs/historial/)
